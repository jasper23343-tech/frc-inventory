"""Small helpers for the Vercel Python functions."""
import json, os, sys

sys.path.insert(0, os.path.dirname(__file__))


def send(h, code, body, ctype):
    h.send_response(code)
    h.send_header("Content-Type", ctype)
    h.send_header("Content-Length", str(len(body)))
    h.send_header("Cache-Control", "no-store" if ctype == "application/json" else "public, max-age=86400")
    h.end_headers()
    h.wfile.write(body)


def send_json(h, code, obj):
    send(h, code, json.dumps(obj).encode(), "application/json")
