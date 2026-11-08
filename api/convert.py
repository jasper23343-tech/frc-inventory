"""POST /api/convert  (body = photo bytes) -> JPEG. Opens iPhone HEIC photos for browsers that can't."""
import os, sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(__file__))
from _core import to_jpeg  # noqa: E402
from _http import send, send_json  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        if not 0 < n <= 4_400_000:  # Vercel request bodies max out around 4.5 MB
            return send_json(self, 413, {"error": "That photo is too big to convert online. Use a JPG or a smaller photo."})
        try:
            body = to_jpeg(self.rfile.read(n), max_side=1800)
        except ImportError:
            return send_json(self, 501, {"error": "Photo conversion isn't set up on this server."})
        except Exception:
            return send_json(self, 415, {"error": "Couldn't open that photo."})
        send(self, 200, body, "image/jpeg")
