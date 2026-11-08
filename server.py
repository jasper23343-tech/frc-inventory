"""Serves the inventory app and adds web image search for product photos.

    python server.py            # http://localhost:5317 (this computer only)
    python server.py --lan      # also reachable from phones on the same Wi-Fi

GET /api/images?q=...   -> {"results": [{thumb, full, title, page, host}, ...]}
GET /api/image?url=...  -> the image bytes (so the page can resize and keep it)
POST /api/convert       -> any photo (incl. iPhone HEIC) as a JPEG

The same endpoints run as Vercel functions (api/) when deployed.
"""
import argparse, functools, json, sys
import urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "api"))
from _core import MAX_IMAGE, curl, public_url, search_images, to_jpeg  # noqa: E402

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def send_json(self, code, obj):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(u.query)
        if u.path == "/api/images":
            q = (qs.get("q") or [""])[0].strip()[:120]
            if not q:
                return self.send_json(400, {"error": "Type something to search for."})
            try:
                return self.send_json(200, {"results": search_images(q)})
            except Exception as e:  # network down, Bing changed, etc.
                return self.send_json(502, {"error": f"Search failed: {e}"})
        if u.path == "/api/image":
            target = (qs.get("url") or [""])[0]
            if not public_url(target):
                return self.send_json(400, {"error": "That image address isn't allowed."})
            try:
                body, ctype = curl(target, MAX_IMAGE)
            except Exception as e:
                return self.send_json(502, {"error": f"Couldn't download that image: {e}"})
            if not ctype.startswith("image/") or ctype == "image/svg+xml" or not body:
                return self.send_json(415, {"error": "That link isn't a photo."})
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()

    def do_POST(self):
        # iPhone photos (HEIC) don't open in Chrome/Edge on Windows: turn them into JPEGs.
        if urllib.parse.urlparse(self.path).path != "/api/convert":
            return self.send_json(404, {"error": "Not found"})
        n = int(self.headers.get("Content-Length") or 0)
        if not 0 < n <= 60 * 1024 * 1024:
            return self.send_json(413, {"error": "That photo is too big."})
        data = self.rfile.read(n)
        try:
            body = to_jpeg(data)
        except ImportError:
            return self.send_json(501, {"error": "To open iPhone photos, run: pip install pillow pillow-heif"})
        except Exception:
            return self.send_json(415, {"error": "Couldn't open that photo."})
        self.send_response(200)
        self.send_header("Content-Type", "image/jpeg")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        if "/api/" in (args[0] if args else ""):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=5317)
    ap.add_argument("--lan", action="store_true", help="listen on all interfaces so phones on your Wi-Fi can open it")
    a = ap.parse_args()
    host = "0.0.0.0" if a.lan else "127.0.0.1"
    srv = ThreadingHTTPServer((host, a.port), functools.partial(Handler, directory=str(ROOT)))
    print(f"Inventory running at http://localhost:{a.port}" + ("  (also on your LAN IP)" if a.lan else ""))
    srv.serve_forever()
