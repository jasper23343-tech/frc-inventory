"""GET /api/images?q=...  -> photo search results (FRC stores first, then the web)."""
import os, sys, urllib.parse
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(__file__))
from _core import search_images  # noqa: E402
from _http import send_json  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        q = (urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get("q") or [""])[0].strip()[:120]
        if not q:
            return send_json(self, 400, {"error": "Type something to search for."})
        try:
            send_json(self, 200, {"results": search_images(q)})
        except Exception as e:
            send_json(self, 502, {"error": f"Search failed: {e}"})
