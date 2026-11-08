"""Shared code for photo search, image download and photo conversion.
Used by server.py (local) and the Vercel functions in api/ (deployed)."""
import functools, html, ipaddress, json, re, shutil, socket, subprocess
import urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
MAX_IMAGE = 8 * 1024 * 1024


def curl(url, max_bytes=3 * 1024 * 1024, timeout=12):
    """GET a URL; returns (bytes, content_type). Uses curl when it's installed
    (it copes with Windows certificate stores), otherwise Python's urllib."""
    if shutil.which("curl"):
        out = subprocess.run(
            ["curl", "-sSL", "-g", "--max-time", str(timeout), "--max-filesize", str(max_bytes), "--max-redirs", "4",
             "--proto", "=http,https", "-A", UA, "-H", "Accept-Language: en-US,en;q=0.9",
             "-w", "\n%{content_type}", url],
            capture_output=True, timeout=timeout + 3)
        if out.returncode == 0:
            body, _, ctype = out.stdout.rpartition(b"\n")
            return body, ctype.decode(errors="replace").split(";")[0].strip().lower()
        if out.returncode not in (2, 127):  # 2/127: curl itself unusable -> try urllib
            raise OSError(out.stderr.decode(errors="replace").strip() or f"curl exit {out.returncode}")
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        body = r.read(max_bytes + 1)
        if len(body) > max_bytes:
            raise OSError("too big")
        return body, (r.headers.get("Content-Type") or "").split(";")[0].strip().lower()


def public_url(url):
    """Only fetch http(s) URLs whose host resolves to a public address."""
    u = urllib.parse.urlparse(url)
    if u.scheme not in ("http", "https") or not u.hostname:
        return False
    try:
        infos = socket.getaddrinfo(u.hostname, u.port or (443 if u.scheme == "https" else 80))
    except OSError:
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
            return False
    return True


# FRC stores first: their own product photos are what the parts in the shop look like.
SHOPIFY_STORES = [
    ("CTR Electronics", "store.ctr-electronics.com"),
    ("AndyMark", "www.andymark.com"),
    ("WCP", "wcproducts.com"),
    ("ThriftyBot", "thethriftybot.com"),
    ("SDS", "www.swervedrivespecialties.com"),
]
FRC_WORDS = re.compile(r"\b(frc|first robotics|robotics|robot)\b", re.I)


def store_query(q):
    """Stores only sell FRC parts, so 'frc' in the name only hurts their search."""
    return re.sub(r"\s+", " ", FRC_WORDS.sub(" ", q)).strip() or q


STOP = {"in", "the", "a", "an", "of", "for", "and", "with", "in", "x", "pack", "pcs", "set"}


def stem(w):
    return w[:-3] + "y" if w.endswith("ies") else w[:-1] if len(w) > 3 and w.endswith("s") and not w.endswith("ss") else w


def query_words(q):
    q = q.lower().replace("×", " ").replace('"', " in ").replace("”", " in ")
    return [stem(w.lstrip("#")) for w in re.findall(r"[a-z0-9#./-]+", q) if w.lstrip("#") and w.lstrip("#") not in STOP]


def match_score(words, title):
    if not words:
        return 0
    t = " ".join(query_words(title))
    tw = set(t.split())
    # a thread size (8-32, 10-32) has to match exactly or it's a different part
    if any(re.fullmatch(r"\d+-\d+", w) and w not in tw for w in words):
        return 0
    hit = sum(1 for w in words if w in tw or (w.isalpha() and len(w) > 3 and w in t))
    return hit / len(words)


def shopify(name, host, q, limit=8):
    url = f"https://{host}/search/suggest.json?" + urllib.parse.urlencode(
        {"q": q, "resources[type]": "product", "resources[limit]": limit})
    body, _ = curl(url, timeout=8)
    out = []
    for p in json.loads(body).get("resources", {}).get("results", {}).get("products", []):
        img = p.get("image") or (p.get("featured_image") or {}).get("url")
        if not img:
            continue
        img = "https:" + img if img.startswith("//") else img
        sep = "&" if "?" in img else "?"
        page = urllib.parse.urljoin(f"https://{host}", (p.get("url") or "").split("?")[0])
        out.append({"full": img, "thumb": f"{img}{sep}width=360", "title": p.get("title") or "",
                    "page": page, "host": name, "store": True})
    return out


def rev(q, limit=8):
    body, _ = curl("https://www.revrobotics.com/search.php?" + urllib.parse.urlencode({"search_query": q}), timeout=8)
    s = body.decode("utf-8", errors="replace")
    out = []
    for m in re.finditer(r'<figure class="card-figure">\s*<a href="([^"]+)".*?<img src="([^"]+)" alt="([^"]*)"', s, re.S):
        page, img, title = (html.unescape(x) for x in m.groups())
        if "/products/" not in img:
            continue
        out.append({"full": img.replace("/590x590/", "/1280x1280/"), "thumb": img.replace("/590x590/", "/320w/"),
                    "title": title, "page": page.split("?")[0], "host": "REV Robotics", "store": True})
        if len(out) >= limit:
            break
    return out


def robosource(q, limit=6):
    body, _ = curl("https://www.robosource.net/search?" + urllib.parse.urlencode({"search_query": q}), timeout=8)
    s = body.decode("utf-8", errors="replace")
    out = []
    for m in re.finditer(r'class="product_img_link" href="([^"]+)" title="([^"]*)"[^>]*>\s*<img[^>]*src="([^"]+)"', s):
        page, title, img = (html.unescape(x) for x in m.groups())
        out.append({"full": img.replace("home_default", "large_default"), "thumb": img, "title": title,
                    "page": page.split("?")[0], "host": "Robosource", "store": True})
        if len(out) >= limit:
            break
    return out


def search_images(q):
    """Store results first (interleaved so one store doesn't fill the page), then the web."""
    sq = store_query(q)
    jobs = [lambda: rev(sq)] + [functools.partial(shopify, n, h, sq) for n, h in SHOPIFY_STORES] + \
           [lambda: robosource(sq), lambda: bing(q)]
    with ThreadPoolExecutor(len(jobs)) as ex:
        futs = [ex.submit(j) for j in jobs]
        lists = []
        for f in futs:
            try:
                lists.append(f.result(timeout=15))
            except Exception:
                lists.append([])
    stores, web = lists[:-1], lists[-1]
    # Store searches return loose matches (a motor controller for "zip tie mounts"),
    # so keep only titles that share most of the words, best first.
    words = query_words(sq)
    scored = []
    for lst in stores:
        for rank, x in enumerate(lst):
            s = match_score(words, x["title"])
            if s >= 0.5:
                scored.append((-s, rank, x))
    scored.sort(key=lambda t: (t[0], t[1]))
    out, seen = [], set()
    for _, _, x in scored:
        if x["full"] not in seen:
            seen.add(x["full"]); out.append(x)
    for x in web:
        if x["full"] not in seen:
            seen.add(x["full"]); out.append(x)
    return out


def bing(q, count=30):
    # Bing reads "FRC" as an Eaton breaker model, so spell the context out.
    if FRC_WORDS.search(q):
        q = store_query(q) + " FRC robot part"
    url = "https://www.bing.com/images/async?" + urllib.parse.urlencode(
        {"q": q, "first": 0, "count": count, "mmasync": 1, "adlt": "strict"})
    body, _ = curl(url)
    results, seen = [], set()
    for m in re.finditer(r'\bm="(\{[^"]+\})"', body.decode("utf-8", errors="replace")):
        try:
            d = json.loads(html.unescape(m.group(1)))
        except ValueError:
            continue
        full, thumb = d.get("murl"), d.get("turl")
        if not full or not thumb or full in seen:
            continue
        seen.add(full)
        page = d.get("purl") or full
        results.append({"full": full, "thumb": thumb, "title": d.get("t") or "", "page": page,
                        "host": (urllib.parse.urlparse(page).hostname or "").removeprefix("www.")})
    return results


def to_jpeg(data, max_side=2400):
    import io
    from PIL import Image, ImageOps
    try:
        import pillow_heif
        pillow_heif.register_heif_opener()
    except ImportError:
        if data[4:12] in (b"ftypheic", b"ftypheix", b"ftypmif1", b"ftyphevc", b"ftypmsf1"):
            raise
    im = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")
    im.thumbnail((max_side, max_side))
    out = io.BytesIO()
    im.save(out, "JPEG", quality=88)
    return out.getvalue()
