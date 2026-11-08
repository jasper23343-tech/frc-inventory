"""GET /api/image?url=...  -> the image bytes, so the page can crop and keep it."""
import os, sys, urllib.parse
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(__file__))
from _core import curl, public_url  # noqa: E402
from _http import send, send_json  # noqa: E402

LIMIT = 4 * 1024 * 1024  # Vercel responses max out around 4.5 MB


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        target = (urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get("url") or [""])[0]
        if not public_url(target):
            return send_json(self, 400, {"error": "That image address isn't allowed."})
        try:
            body, ctype = curl(target, LIMIT)
        except Exception as e:
            return send_json(self, 502, {"error": f"Couldn't download that image: {e}"})
        if not ctype.startswith("image/") or ctype == "image/svg+xml" or not body:
            return send_json(self, 415, {"error": "That link isn't a photo."})
        send(self, 200, body, ctype)
