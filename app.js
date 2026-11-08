(() => {
  "use strict";

  const KEY = "frc-inventory-v6";
  const CONF = {
    perfect: { label: "Perfect", short: "Perfect" },
    good: { label: "Really good", short: "Good" },
    rough: { label: "Rough estimate", short: "Rough" },
    bad: { label: "Way off", short: "Way off" }
  };
  const THEME_KEY = "frc-inventory-theme";
  const $ = (s, el = document) => el.querySelector(s);
  const areaById = Object.fromEntries(AREAS.map(a => [a.id, a]));

  const icon = {
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    expand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/></svg>',
    camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    count: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="7" r="2.5"/><circle cx="7" cy="17" r="2.5"/><path d="M14.5 17h5M17 14.5v5"/></svg>',
    paste: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4.5" width="14" height="16" rx="2"/><path d="M9 4.5V3h6v1.5M9 10h6M9 14h4"/></svg>',
    crop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2"/></svg>',
    image: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m4 17 5-5 4 4 2.5-2.5L20 18"/></svg>',
    box: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/></svg>'
  };

  // ---------- state ----------
  const clone = o => JSON.parse(JSON.stringify(o));
  function seed() { return SEED_PARTS.map(p => ({ ...clone(p), reported: SEED_DATE, source: "photo" })); }
  const deleted = new Set(); // seed parts deleted in the app, so data.js doesn't bring them back
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && Array.isArray(s.parts)) { (s.deleted || []).forEach(id => deleted.add(id)); return mergeSeed(s.parts); }
    } catch (e) {}
    return seed();
  }
  // New photos and names in data.js reach saved data without wiping counts.
  // Photos picked in the app (coverImg) and names edited in the app win.
  function mergeSeed(list) {
    const seedById = Object.fromEntries(SEED_PARTS.map(p => [p.id, p]));
    list.forEach(p => {
      const s = seedById[p.id];
      if (!s) return;
      ["cover", "img", "f"].forEach(k => { if (s[k] !== undefined) p[k] = s[k]; });
      if (!p.nameEdited) p.name = s.name;
      if (!p.placeEdited) { p.area = s.area; p.spot = s.spot; }
      // never counted in the app: follow data.js (e.g. parts that were split up)
      if (p.source === "photo") ["qty", "unit", "min", "conf", "sub", "cat"].forEach(k => { if (s[k] !== undefined) p[k] = s[k]; });
    });
    // new parts in data.js (that weren't deleted here)
    const have = new Set(list.map(p => p.id));
    SEED_PARTS.forEach((sp, i) => {
      if (have.has(sp.id) || deleted.has(sp.id)) return;
      const at = list.findIndex(p => p.id === SEED_PARTS[i - 1]?.id);
      list.splice(at < 0 ? list.length : at + 1, 0, { ...clone(sp), reported: SEED_DATE, source: "photo" });
    });
    // Parts added in the app that point at a place that no longer exists
    const ids = new Set(AREAS.map(a => a.id));
    const OLD = { chest: "husky", bench: "husky", lower: "husky" };
    list.forEach(p => {
      if (ids.has(p.area)) return;
      p.area = OLD[p.area] || (p.cat === "Electrical" ? "husky-elec" : "husky-mech");
    });
    return list;
  }
  let parts = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ parts, deleted: [...deleted] })); return true; }
    catch (e) { toast("Storage is full. Try a smaller photo."); return false; }
  }
  const byId = id => parts.find(p => p.id === id);
  const isLow = p => p.min > 0 && p.qty < p.min;

  const ui = { cat: "All", subs: new Set(), area: null, q: "" };
  const subsOf = name => (CATEGORIES.find(c => c.name === name) || { subs: [] }).subs;

  // ---------- helpers ----------
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const placeColor = id => areaById[id]?.color || "var(--muted)";
  const placePin = id => `<span class="apin" style="--pc:${placeColor(id)}">${icon.pin}</span>`;
  const where = p => `${areaById[p.area]?.name || p.area || "Unknown"}${p.spot ? " · " + p.spot : ""}`;

  // Cover: a vendor product photo, a close-up cropped from the shop photos ("shop-*"),
  // or the first photo someone added in the app.
  function coverOf(p) {
    if (p.coverImg) return { src: p.coverImg, by: p.coverBy, vendor: true, custom: true };
    if (p.cover && p.cover.startsWith("shop-")) return { src: `img/cover/${p.cover}.jpg`, shop: true };
    if (p.cover && p.cover.startsWith("gen-")) return { src: `img/cover/${p.cover}.jpg`, gen: true };
    if (p.cover) return { src: `img/cover/${p.cover}.jpg`, by: COVER_SOURCES[p.cover], vendor: true };
    if (p.extra && p.extra.length) return { src: p.extra[0].src, user: true };
    return null;
  }

  // Every shop photo of this part, oldest first, each with when it was taken.
  function shopPhotos(p) {
    const keys = [];
    const add = k => { if (k && PHOTO_DATES[k] && !keys.includes(k)) keys.push(k); };
    if (p.img) {
      add(p.img); add(p.img + "_1"); add(p.img + "_2");
      (RELATED[p.img] || []).forEach(add);
    }
    const shop = keys.map(k => ({ src: `img/${k}.jpg`, thumb: `img/thumb/${k}.jpg`, date: PHOTO_DATES[k] }));
    const mine = (p.extra || []).filter(x => !(coverOf(p)?.user && x === p.extra[0])).map(x => ({ src: x.src, thumb: x.src, date: x.date }));
    return [...shop, ...mine];
  }

  function coverHtml(p, { eager = false } = {}) {
    const c = coverOf(p);
    if (!c) return photo(p, { eager });
    return `<div class="ph${c.vendor ? " cover" : ""}"><img src="${esc(c.src)}" alt="" ${eager ? "" : 'loading="lazy"'} decoding="async" data-loading onload="this.removeAttribute('data-loading')"></div>`;
  }

  const fmtDate = iso => {
    const d = new Date(iso);
    return {
      day: d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
      time: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    };
  };

  function photo(p, { thumb = true, zoom = 1, eager = false } = {}) {
    const src = p.photo || (p.img ? `img/${thumb ? "thumb/" : ""}${p.img}.jpg` : "");
    if (!src) return `<div class="ph none">${icon.box}</div>`;
    const [x, y, z] = p.photo ? [50, 50, 1] : (p.f || [50, 50, 1]);
    return `<div class="ph" style="--x:${x}%;--y:${y}%;--z:${Math.max(1, z * zoom).toFixed(2)}">` +
      `<img src="${esc(src)}" alt="" ${eager ? "" : 'loading="lazy"'} decoding="async" data-loading onload="this.removeAttribute('data-loading')"></div>`;
  }

  function ago(iso) {
    const d = new Date(iso), s = (Date.now() - d) / 1000;
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  const norm = s => String(s).toLowerCase()
    .replace(/×/g, "x").replace(/["”″]/g, "").replace(/[‑–—-]/g, " ").replace(/\s+/g, " ");
  const SYN = { screw: "bolt", screws: "bolt", nut: "nut", cable: "wire", cables: "wire", motor: "motor", controller: "controller" };
  function tokens(q) {
    return norm(q).split(" ").filter(Boolean).map(t => SYN[t] || (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t));
  }
  function search(list, q) {
    const ts = tokens(q);
    if (!ts.length) return list;
    return list
      .map(p => {
        const name = norm(p.name), hay = norm(`${p.name} ${p.cat} ${p.sub || ""} ${where(p)} ${p.id}`);
        if (!ts.every(t => hay.includes(t))) return null;
        let score = 0;
        ts.forEach(t => { if (name.includes(t)) score += 2; if (name.startsWith(t)) score += 2; });
        return { p, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .map(r => r.p);
  }

  // ---------- library ----------
  function filtered() {
    let list = parts;
    if (ui.area) list = list.filter(p => p.area === ui.area);
    if (ui.cat !== "All") list = list.filter(p => p.cat === ui.cat);
    if (ui.subs.size) list = list.filter(p => ui.subs.has(p.sub));
    return search(list, ui.q);
  }

  function renderChips() {
    const base = ui.area ? parts.filter(p => p.area === ui.area) : parts;
    const cats = ["All", ...CATEGORIES.map(c => c.name).filter(c => base.some(p => p.cat === c))];
    if (!cats.includes(ui.cat)) { ui.cat = "All"; ui.subs.clear(); }
    $("#chips").innerHTML = cats.map(c => {
      const n = c === "All" ? base.length : base.filter(p => p.cat === c).length;
      return `<button class="chip" type="button" data-cat="${esc(c)}" aria-pressed="${c === ui.cat}">${esc(c)}<span class="n num">${n}</span></button>`;
    }).join("");
    const chipsEl = $("#chips"), sel = chipsEl.querySelector('[aria-pressed="true"]');
    if (sel) {
      const l = sel.offsetLeft - chipsEl.offsetLeft, r = l + sel.offsetWidth;
      if (l < chipsEl.scrollLeft + 16 || r > chipsEl.scrollLeft + chipsEl.clientWidth - 32) chipsEl.scrollLeft = l - 16;
    }
    const fb = $("#filter-btn"), n = ui.subs.size;
    fb.classList.toggle("on", n > 0);
    fb.querySelector(".fb-n").textContent = n || "";
    fb.setAttribute("aria-label", n ? `Subcategory filter, ${n} on` : "Filter by subcategory");
    $("#sub-row").hidden = !n;
    $("#sub-row").innerHTML = [...ui.subs].map(sb => `<button class="sub-pill" type="button" data-unsub="${esc(sb)}" aria-label="Remove ${esc(sb)} filter">${esc(sb)}${icon.close}</button>`).join("");
  }

  // ---------- subcategory filter sheet ----------
  const filterSheet = $("#filter");
  function renderFilter() {
    const base = (ui.area ? parts.filter(p => p.area === ui.area) : parts);
    const groups = CATEGORIES.filter(c => ui.cat === "All" || c.name === ui.cat);
    const count = filtered().length;
    filterSheet.innerHTML = `<div class="menu-body">
      <div class="f-title"><h2 id="f-title">${ui.cat === "All" ? "Filter" : esc(ui.cat)}</h2>
        ${ui.subs.size ? `<button class="link-btn" type="button" data-fclear>Clear</button>` : ""}</div>
      ${groups.map(g => {
        const subs = g.subs.filter(sb => base.some(p => p.cat === g.name && p.sub === sb));
        if (!subs.length) return "";
        return `<div class="f-group">${ui.cat === "All" ? `<h3>${esc(g.name)}</h3>` : ""}<div class="f-chips">${subs.map(sb => {
          const n = base.filter(p => p.sub === sb).length;
          return `<button class="chip" type="button" data-sub="${esc(sb)}" aria-pressed="${ui.subs.has(sb)}">${esc(sb)}<span class="n num">${n}</span></button>`;
        }).join("")}</div></div>`;
      }).join("")}
      <button class="btn block" type="button" data-fdone>Show ${count} ${count === 1 ? "part" : "parts"}</button>
    </div>`;
  }
  $("#filter-btn").addEventListener("click", () => { renderFilter(); filterSheet.showModal(); });
  filterSheet.addEventListener("click", e => {
    if (e.target === filterSheet) return filterSheet.close();
    const t = e.target.closest("button"); if (!t) return;
    if (t.dataset.sub) { ui.subs.has(t.dataset.sub) ? ui.subs.delete(t.dataset.sub) : ui.subs.add(t.dataset.sub); }
    else if (t.matches("[data-fclear]")) ui.subs.clear();
    else if (t.matches("[data-fdone]")) return filterSheet.close();
    renderFilter(); renderLibrary();
  });
  $("#sub-row").addEventListener("click", e => {
    const t = e.target.closest("[data-unsub]"); if (!t) return;
    ui.subs.delete(t.dataset.unsub); renderLibrary();
  });

  function card(p) {
    const low = isLow(p);
    return `<a class="card" href="#/part/${encodeURIComponent(p.id)}">
      ${coverHtml(p)}
      ${p.items ? `<span class="set-tag" title="${p.items.length} kinds in this set">${icon.plus}${p.items.length}</span>` : ""}
      <span class="qty${low ? " low" : ""}"><i class="dot c-${p.conf || "rough"}" title="${CONF[p.conf || "rough"].label}"></i>${p.qty}<small>${esc(p.unit || "pcs")}</small></span>
      <div class="body">
        <div class="name">${esc(p.name)}</div>
        <div class="where">${placePin(p.area)}<span>${esc(areaById[p.area]?.name || p.area)}</span></div>
      </div>
    </a>`;
  }

  function renderLibrary() {
    renderChips();
    const list = filtered();
    const searching = !!ui.q.trim();

    const af = $("#area-filter");
    if (ui.area) {
      af.hidden = false;
      af.innerHTML = `<button class="area-pill" type="button" id="area-clear" aria-label="Stop filtering by ${esc(areaById[ui.area].name)}">${placePin(ui.area)}${esc(areaById[ui.area].name)}${icon.close}</button>`;
    } else { af.hidden = true; af.innerHTML = ""; }

    const low = parts.filter(isLow);
    const showStrip = !searching && !ui.area && ui.cat === "All" && !ui.subs.size && low.length;
    $("#low-strip-wrap").innerHTML = showStrip ? `<div class="low-strip">
      <div class="list-head"><h2>Running low</h2><a class="count" href="#/low">See all ${low.length}</a></div>
      <div class="hscroll">${low.map(p => `<a class="mini" href="#/part/${encodeURIComponent(p.id)}">${coverHtml(p)}<div><b>${esc(p.name)}</b><span class="num">${p.qty} left · want ${p.min}</span></div></a>`).join("")}</div>
    </div>` : "";

    $("#list-title").textContent = searching ? "Results" : ui.subs.size === 1 ? [...ui.subs][0] : ui.cat !== "All" ? ui.cat : ui.area ? "Everything here" : "All parts";
    $("#list-count").textContent = `${list.length} ${list.length === 1 ? "part" : "parts"}`;
    $("#grid").innerHTML = list.map(card).join("");
    $("#empty").hidden = list.length > 0;
    $("#lib-sub").textContent = `${parts.length} parts across ${AREAS.length} places`;
    $("#q-clear").hidden = !ui.q;
    updateBadge();
  }

  function updateBadge() {
    const n = parts.filter(isLow).length, b = $("#low-badge");
    b.hidden = !n; b.textContent = n;
  }

  // ---------- places ----------
  function renderPlaces() {
    $("#places").innerHTML = AREAS.map(a => {
      const n = parts.filter(p => p.area === a.id).length;
      return `<a class="place" href="#/area/${a.id}">
        ${a.pic ? `<div class="ph place-pic"><img src="${a.pic}-thumb.jpg" alt="" loading="lazy" decoding="async"></div>` : photo({ img: a.img, f: a.f })}
        <span class="tag num"><i class="pdot" style="--pc:${a.color}"></i>${n} parts</span>
        <div class="meta"><div><h3>${esc(a.name)}</h3><p>${esc(a.blurb)}</p></div><span class="go">${icon.arrow}</span></div>
      </a>`;
    }).join("");
  }

  // ---------- low ----------
  function renderLow() {
    const low = parts.filter(isLow).sort((a, b) => a.qty / a.min - b.qty / b.min);
    $("#low-sub").textContent = low.length ? `${low.length} parts under their alert level` : "Everything is stocked";
    $("#low-list").innerHTML = low.length ? low.map(p => `<a class="row" href="#/part/${encodeURIComponent(p.id)}">
        ${coverHtml(p)}
        <div class="txt"><b>${esc(p.name)}</b><small>${esc(where(p))}</small></div>
        <div class="have"><strong>${p.qty}</strong><span>want ${p.min}</span></div>
      </a>`).join("") : `<div class="empty"><p class="empty-t">Nothing is running low.</p><p class="empty-s">Parts show up here when the count drops under their alert level.</p></div>`;
  }

  // ---------- step size (×1, ×5, ×10, ×25) ----------
  const STEPS = [1, 5, 10, 25];
  let stepSize = 1;
  const stepBtn = () => `<button type="button" class="step-size" data-step-size aria-label="Step size: ${stepSize} at a time">×${stepSize}</button>`;
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-step-size]");
    if (!t) return;
    stepSize = STEPS[(STEPS.indexOf(stepSize) + 1) % STEPS.length];
    document.querySelectorAll("[data-step-size]").forEach(b => { b.textContent = `×${stepSize}`; b.setAttribute("aria-label", `Step size: ${stepSize} at a time`); });
  });

  // ---------- detail ----------
  const detail = $("#detail");
  let draftQty = null;

  function renderDetail(p) {
    const area = areaById[p.area];
    const nearby = parts.filter(o => o.id !== p.id && o.area === p.area && o.spot.split(" · ")[0] === p.spot.split(" · ")[0]).slice(0, 8);
    draftQty = p.qty;
    const slides = slidesFor(p);
    const shop = slides.filter(x => x.date);
    const conf = p.conf || "rough";
    detail.innerHTML = `<div class="scroll">
      <div class="d-hero${coverOf(p)?.vendor ? " is-cover" : ""}">
        ${isAdmin()
          ? `<button class="d-hero-btn" type="button" data-photo-edit aria-label="Change the product photo">${coverHtml(p, { eager: true })}</button>
             <button class="d-edit-photo" type="button" data-photo-edit>${icon.image}Change photo</button>`
          : `<button class="d-hero-btn" type="button" data-view="0" aria-label="Open photos">${coverHtml(p, { eager: true })}</button>`}
        <div class="d-bar">
          <button class="icon-btn" type="button" data-close aria-label="Back">${icon.back}</button>
          <button class="icon-btn" type="button" data-edit aria-label="Edit part">${icon.edit}</button>
        </div>
        ${slides.length > 1 ? `<button class="d-photo-btn" type="button" data-view="0">${icon.expand}${slides.length} photos</button>` : ""}
      </div>
      <div class="d-body">
        <div class="d-cat">${esc(p.cat)}</div>
        <h2 class="d-name" id="d-name">${esc(p.name)}</h2>

        <div class="panel">
          <p class="panel-label"><span>In stock</span><span>Alert under ${p.min}</span></p>
          <div class="stock">
            <div class="big">${p.items ? `<span id="d-qty">${p.qty}</span>` : `<span class="qty-wrap"><span class="qty-mirror num" aria-hidden="true">${p.qty}</span><input id="d-qty" class="qty-in num" size="1" type="number" inputmode="numeric" min="0" value="${p.qty}" aria-label="How many in stock (type a number)" enterkeyhint="done"></span>`}<small>${esc(p.unit || "pcs")}</small></div>
            ${p.items ? `<span class="set-total">Total across the set</span>` : `<div class="stepper">
              <button type="button" data-step="-1" aria-label="Fewer">${icon.minus}</button>
              ${stepBtn()}
              <button type="button" data-step="1" aria-label="More">${icon.plus}</button>
            </div>`}
          </div>
          <span class="status ${isLow(p) ? "low" : "ok"}" id="d-status">${isLow(p) ? "Running low" : "In stock"}</span>
          <div class="conf">
            <p class="panel-label"><span>How accurate is this count?</span></p>
            <div class="conf-seg" role="radiogroup" aria-label="Count accuracy">${Object.entries(CONF).map(([k, v]) =>
              `<button type="button" role="radio" data-conf="${k}" aria-checked="${k === conf}"><i class="dot c-${k}"></i>${v.short}</button>`).join("")}</div>
          </div>
          <div class="save-row" id="d-save">
            <button class="btn ghost" type="button" data-undo>Undo</button>
            <button class="btn" type="button" data-save>Save count</button>
          </div>
        </div>

        ${p.items ? setPanel(p) : ""}

        <div class="panel">
          <p class="panel-label"><span>Where it is</span></p>
          <div class="loc">
            <span class="pin" style="--pc:${placeColor(p.area)}">${icon.pin}</span>
            <div><b>${esc(area?.name || p.area)}</b><span>${esc(p.spot || "No spot set")}</span></div>
            <a href="#/area/${esc(p.area)}">Open</a>
          </div>
        </div>
        <p class="reported">${p.source === "photo" ? `Counted from shop photos · ${CONF[conf].label.toLowerCase()}` : `Updated ${ago(p.reported)} · ${CONF[conf].label.toLowerCase()}`}</p>

        ${shop.length ? `<div class="d-more"><h3>Shop photos <span class="count">${shop.length}</span></h3><div class="hscroll shots">${shop.map(x => {
          const d = fmtDate(x.date);
          return `<button class="shot" type="button" data-view="${slides.indexOf(x)}"><span class="ph"><img src="${esc(x.thumb)}" alt="" loading="lazy" decoding="async"></span><b>${d.day}</b><span>${d.time}</span></button>`;
        }).join("")}</div></div>` : ""}

        <button class="btn danger block d-delete" type="button" data-delete-part>Delete part</button>

        ${nearby.length ? `<div class="d-more"><h3>Also in this spot</h3><div class="hscroll">${nearby.map(o => `<a class="mini" href="#/part/${encodeURIComponent(o.id)}" data-replace>${coverHtml(o)}<div><b>${esc(o.name)}</b><span class="num" style="color:var(--muted)">${o.qty} ${esc(o.unit)}</span></div></a>`).join("")}</div></div>` : ""}
      </div>
    </div>`;
    detail.dataset.id = p.id;
    fitQty($("#d-qty"));
  }

  // A set (screwdrivers, crimpers, hex keys) shows each tool with its photo;
  // a set without photos (wrenches) shows a size list behind a + button.
  function setPanel(p) {
    const withImg = p.items.filter(it => it.img);
    const step = (it, i) => `<div class="mini-step">
        <button type="button" data-item-step="-1" data-i="${i}" aria-label="One less ${esc(it.name)}">${icon.minus}</button>
        <span class="num" data-item-qty="${i}">${it.qty}</span>
        <button type="button" data-item-step="1" data-i="${i}" aria-label="One more ${esc(it.name)}">${icon.plus}</button></div>`;
    if (withImg.length) {
      return `<div class="d-more"><h3>In this set <span class="count">${p.items.length} kinds</span></h3>
        <div class="set-grid">${p.items.map((it, i) => `<div class="set-item">
          <button class="si-ph ph" type="button" data-item-view="${i}" aria-label="View ${esc(it.name)}">${it.img ? `<img src="img/${esc(it.img)}.jpg" alt="" loading="lazy" decoding="async">` : icon.box}</button>
          <b>${esc(it.name)}</b>${step(it, i)}</div>`).join("")}</div></div>`;
    }
    const groups = [...new Set(p.items.map(it => it.group || ""))];
    return `<div class="panel sizes">
      <button class="sizes-toggle" type="button" data-sizes aria-expanded="false" aria-controls="d-sizes">
        <span class="st-icon">${icon.plus}</span><span><b>Sizes</b><small>${p.items.length} sizes · tap to see how many of each</small></span></button>
      <div class="size-list" id="d-sizes" hidden>${groups.map(g => `${g ? `<h4>${esc(g)}</h4>` : ""}${p.items.map((it, i) => (it.group || "") !== g ? "" :
        `<div class="size-row"><span>${esc(it.name)}</span>${step(it, i)}</div>`).join("")}`).join("")}</div>
    </div>`;
  }

  function stepItem(i, d) {
    const p = byId(detail.dataset.id), it = p.items[i];
    it.qty = Math.max(0, it.qty + d);
    p.qty = p.items.reduce((n, x) => n + x.qty, 0);
    p.reported = new Date().toISOString(); p.source = "count";
    if (!save()) return;
    detail.querySelector(`[data-item-qty="${i}"]`).textContent = it.qty;
    $("#d-qty").textContent = p.qty;
    const st = $("#d-status"); st.className = `status ${isLow(p) ? "low" : "ok"}`; st.textContent = isLow(p) ? "Running low" : "In stock";
    refresh();
  }

  // The number box is as wide as a hidden copy of the number next to it.
  const fitQty = el => { const m = el && el.previousElementSibling; if (m && m.classList.contains("qty-mirror")) m.textContent = el.value || "0"; };
  function setDraft(n, typing = false) {
    const p = byId(detail.dataset.id);
    draftQty = Math.max(0, n);
    const q = $("#d-qty");
    if (!typing) q.value = draftQty;
    fitQty(q);
    const low = p.min > 0 && draftQty < p.min, st = $("#d-status");
    st.className = `status ${low ? "low" : "ok"}`; st.textContent = low ? "Running low" : "In stock";
    $("#d-save").classList.toggle("on", draftQty !== p.qty);
  }

  detail.addEventListener("input", e => {
    if (e.target.id === "d-qty") setDraft(parseInt(e.target.value, 10) || 0, true);
  });
  detail.addEventListener("keydown", e => {
    if (e.target.id === "d-qty" && e.key === "Enter") { e.preventDefault(); $("#d-save").classList.contains("on") ? detail.querySelector("[data-save]").click() : e.target.blur(); }
  });
  detail.addEventListener("click", e => {
    const t = e.target.closest("button, a");
    if (!t) { if (e.target === detail) closeRoute(); return; }
    if (t.matches("[data-close]")) closeRoute();
    else if (t.matches("[data-edit]")) go(`#/edit/${encodeURIComponent(detail.dataset.id)}`, true);
    else if (t.matches("[data-view]")) openViewer(byId(detail.dataset.id), Number(t.dataset.view) || 0);
    else if (t.matches("[data-photo-edit]")) openPhotoEditor(byId(detail.dataset.id));
    else if (t.matches("[data-delete-part]")) { const p = byId(detail.dataset.id); if (armed(t, `Tap again to delete “${p.name}”`)) deletePart(p); }
    else if (t.matches("[data-conf]")) {
      const p = byId(detail.dataset.id);
      p.conf = t.dataset.conf;
      if (save()) {
        detail.querySelectorAll("[data-conf]").forEach(b => b.setAttribute("aria-checked", b === t));
        toast(`Marked ${CONF[p.conf].label.toLowerCase()}`); refresh();
      }
    }
    else if (t.matches("[data-step]")) setDraft(draftQty + Number(t.dataset.step) * stepSize);
    else if (t.matches("[data-item-step]")) stepItem(Number(t.dataset.i), Number(t.dataset.itemStep));
    else if (t.matches("[data-item-view]")) openItemViewer(byId(detail.dataset.id), Number(t.dataset.itemView));
    else if (t.matches("[data-sizes]")) {
      const open = t.getAttribute("aria-expanded") !== "true";
      t.setAttribute("aria-expanded", open); $("#d-sizes").hidden = !open;
    }
    else if (t.matches("[data-undo]")) setDraft(byId(detail.dataset.id).qty);
    else if (t.matches("[data-save]")) {
      const p = byId(detail.dataset.id);
      p.qty = draftQty; p.reported = new Date().toISOString(); p.source = "count";
      if (save()) { toast(`Saved: ${p.qty} ${p.unit}`); renderDetail(p); refresh(); }
    } else if (t.matches("[data-replace]")) { e.preventDefault(); go(t.getAttribute("href"), true); }
    else if (t.matches(".loc a")) { e.preventDefault(); go(t.getAttribute("href")); }
  });

  // ---------- viewer ----------
  const viewer = $("#viewer");
  // Slide 0 is the product cover (no date); the rest are dated shop photos.
  function slidesFor(p) {
    const c = coverOf(p), list = [];
    if (c) list.push({ src: c.src, thumb: c.src, cover: !!c.vendor, closeup: !!c.shop, gen: !!c.gen, by: c.by, date: c.user ? p.extra[0].date : null });
    shopPhotos(p).forEach(x => list.push(x));
    if (!list.length && p.photo) list.push({ src: p.photo, thumb: p.photo, date: null });
    return list;
  }

  function openItemViewer(p, i) {
    const slides = p.items.filter(it => it.img).map(it => ({ src: `img/${it.img}.jpg`, caption: it.name, sub: `${it.qty} in the set · close-up from the shop photos` }));
    const start = p.items.filter((it, j) => it.img && j < i).length;
    openViewer(p, start, slides);
  }

  function openViewer(p, start = 0, custom) {
    const slides = custom || slidesFor(p);
    if (!slides.length) return;
    viewer.innerHTML = `<div class="v-top">
        <span class="v-count num" id="v-count">1 / ${slides.length}</span>
        <button class="icon-btn" type="button" data-vclose aria-label="Close photos">${icon.close}</button>
      </div>
      <div class="v-track" id="v-track">${slides.map((x, i) => {
        let cap;
        if (x.caption) cap = `<b>${esc(x.caption)}</b><span>${esc(x.sub || "")}</span>`;
        else if (x.cover) cap = `<b>Product photo</b><span>${x.by ? (x.by.url ? `from <a href="${esc(x.by.url)}" target="_blank" rel="noopener">${esc(x.by.src)}</a>` : esc(x.by.src)) : ""}</span>`;
        else if (x.closeup) cap = `<b>Close-up</b><span>Cropped from the shop photos</span>`;
        else if (x.gen) cap = `<b>Example of what it looks like</b><span>AI-generated reference image, not a shop photo</span>`;
        else if (x.date) { const d = fmtDate(x.date); cap = `<b>${d.day} · ${d.time}</b><span>Shop photo</span>`; }
        else cap = `<b>Shop photo</b><span>Date unknown</span>`;
        return `<figure class="v-slide${x.cover ? " is-cover" : ""}" data-i="${i}"><div class="v-img"><img src="${esc(x.src)}" alt="${x.cover ? "Product photo of " : "Shop photo showing "}${esc(p.name)}" decoding="async"></div><figcaption>${cap}</figcaption></figure>`;
      }).join("")}</div>
      ${slides.length > 1 ? `<button class="v-nav prev" type="button" data-vstep="-1" aria-label="Previous photo">${icon.back}</button>
      <button class="v-nav next" type="button" data-vstep="1" aria-label="Next photo">${icon.back}</button>` : ""}`;
    viewer.showModal();
    const track = $("#v-track"), el = track.children[start] || track.children[0];
    track.scrollLeft = el.offsetLeft - (track.clientWidth - el.clientWidth) / 2;
    updateCount();
  }

  function currentSlide() {
    const track = $("#v-track"), mid = track.scrollLeft + track.clientWidth / 2;
    let best = 0, dist = Infinity;
    [...track.children].forEach((el, i) => { const d = Math.abs(el.offsetLeft + el.clientWidth / 2 - mid); if (d < dist) { dist = d; best = i; } });
    return best;
  }
  function updateCount() {
    const track = $("#v-track"); if (!track) return;
    const i = currentSlide(), n = track.children.length;
    $("#v-count").textContent = `${i + 1} / ${n}`;
    [...track.children].forEach((el, j) => el.classList.toggle("on", j === i));
    viewer.querySelector(".prev")?.toggleAttribute("disabled", i === 0);
    viewer.querySelector(".next")?.toggleAttribute("disabled", i === n - 1);
  }
  function stepSlide(d) {
    const track = $("#v-track"), i = Math.min(track.children.length - 1, Math.max(0, currentSlide() + d));
    const el = track.children[i];
    track.scrollTo({ left: el.offsetLeft - (track.clientWidth - el.clientWidth) / 2, behavior: "smooth" });
  }
  viewer.addEventListener("scroll", () => { clearTimeout(viewer._t); viewer._t = setTimeout(updateCount, 60); }, true);
  viewer.addEventListener("click", e => {
    const t = e.target.closest("button");
    if (t && t.matches("[data-vclose]")) return viewer.close();
    if (t && t.dataset.vstep) return stepSlide(Number(t.dataset.vstep));
    const slide = e.target.closest(".v-slide");
    if (slide) { const i = Number(slide.dataset.i), c = currentSlide(); if (i !== c) stepSlide(i - c); return; }
    if (!e.target.closest("a")) viewer.close();
  });
  viewer.addEventListener("keydown", e => {
    if (e.key === "ArrowRight") { e.preventDefault(); stepSlide(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); stepSlide(-1); }
  });

  // ---------- admin: product photos ----------
  // No login yet, so admin mode is a switch in Settings, saved on this device.
  const ADMIN_KEY = "frc-inventory-admin";
  function isAdmin() { try { return localStorage.getItem(ADMIN_KEY) === "1"; } catch { return false; } }

  // ---------- getting a photo: download / paste → crop → small JPEG ----------
  function loadImg(src) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error("Couldn't open that image"));
      im.src = src;
    });
  }
  // Crop (fractions of the image) and shrink to at most 800px on a white background.
  async function cropToCover(src, box = { x: 0, y: 0, w: 1, h: 1 }, max = 800) {
    const im = await loadImg(src);
    const sx = box.x * im.naturalWidth, sy = box.y * im.naturalHeight;
    const sw = Math.max(1, box.w * im.naturalWidth), sh = Math.max(1, box.h * im.naturalHeight);
    const k = Math.min(1, max / Math.max(sw, sh));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(sw * k)); c.height = Math.max(1, Math.round(sh * k));
    const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(im, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.82);
  }
  // Web images come through server.py so the page is allowed to read their pixels.
  async function fetchImage(url) {
    if (url.startsWith("data:image/")) return url;
    let r;
    try { r = await fetch(`api/image?url=${encodeURIComponent(url)}`); }
    catch { throw new Error("Downloading web images needs the app started with python server.py"); }
    if (!r.ok) {
      let m = "Couldn't download that image";
      try { m = (await r.json()).error || m; } catch { m = "Downloading web images needs the app started with python server.py"; }
      throw new Error(m);
    }
    return URL.createObjectURL(await r.blob());
  }
  const fileToSrc = file => URL.createObjectURL(file);

  // ---------- cropper ----------
  const cropper = $("#cropper");
  let crop = null; // { src, box, done, revoke }
  function openCropper(src, done, revoke) {
    crop = { src, done, revoke, box: { x: 0, y: 0, w: 1, h: 1 } };
    cropper.innerHTML = `<div class="f-head">
        <button class="icon-btn" type="button" data-close aria-label="Cancel">${icon.close}</button>
        <h2 id="cr-title">Crop photo</h2>
        <span style="width:44px"></span>
      </div>
      <p class="cr-hint">Drag the corners to keep just the part you want. Drag inside the box to move it.</p>
      <div class="cr-stage"><div class="cr-wrap" id="cr-wrap">
        <img src="${esc(src)}" alt="Photo to crop" draggable="false">
        <div class="cr-box" id="cr-box" data-h="move">
          ${["nw", "ne", "sw", "se"].map(h => `<span class="cr-h ${h}" data-h="${h}"></span>`).join("")}
        </div>
      </div></div>
      <div class="cr-actions">
        <button class="btn ghost" type="button" data-crop-reset>Whole photo</button>
        <button class="btn" type="button" data-crop-use>Use photo</button>
      </div>`;
    cropper.showModal();
    drawCrop();
  }
  function drawCrop() {
    const b = crop.box, el = $("#cr-box");
    Object.assign(el.style, { left: b.x * 100 + "%", top: b.y * 100 + "%", width: b.w * 100 + "%", height: b.h * 100 + "%" });
  }
  function closeCropper() {
    if (crop && crop.revoke && crop.src.startsWith("blob:")) URL.revokeObjectURL(crop.src);
    crop = null;
    if (cropper.open) cropper.close();
  }
  let drag = null;
  cropper.addEventListener("pointerdown", e => {
    const h = e.target.closest("[data-h]");
    if (!h || !crop) return;
    e.preventDefault();
    const r = $("#cr-wrap").getBoundingClientRect();
    drag = { mode: h.dataset.h, x0: e.clientX, y0: e.clientY, b0: { ...crop.box }, r };
    h.setPointerCapture(e.pointerId);
  });
  cropper.addEventListener("pointermove", e => {
    if (!drag) return;
    const dx = (e.clientX - drag.x0) / drag.r.width, dy = (e.clientY - drag.y0) / drag.r.height;
    const b = { ...drag.b0 }, MIN = 0.06, clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    if (drag.mode === "move") {
      b.x = clamp(b.x + dx, 0, 1 - b.w); b.y = clamp(b.y + dy, 0, 1 - b.h);
    } else {
      let x1 = b.x, y1 = b.y, x2 = b.x + b.w, y2 = b.y + b.h;
      if (drag.mode.includes("w")) x1 = clamp(x1 + dx, 0, x2 - MIN);
      if (drag.mode.includes("e")) x2 = clamp(x2 + dx, x1 + MIN, 1);
      if (drag.mode.includes("n")) y1 = clamp(y1 + dy, 0, y2 - MIN);
      if (drag.mode.includes("s")) y2 = clamp(y2 + dy, y1 + MIN, 1);
      Object.assign(b, { x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
    }
    crop.box = b; drawCrop();
  });
  ["pointerup", "pointercancel"].forEach(t => cropper.addEventListener(t, () => { drag = null; }));
  cropper.addEventListener("click", async e => {
    const t = e.target.closest("button");
    if (!t || !crop) return;
    if (t.matches("[data-close]")) return closeCropper();
    if (t.matches("[data-crop-reset]")) { crop.box = { x: 0, y: 0, w: 1, h: 1 }; drawCrop(); return; }
    if (t.matches("[data-crop-use]")) {
      t.disabled = true;
      try { const out = await cropToCover(crop.src, crop.box), done = crop.done; closeCropper(); done(out); }
      catch (err) { t.disabled = false; toast(err.message); }
    }
  });
  cropper.addEventListener("cancel", e => { e.preventDefault(); closeCropper(); });

  // ---------- paste from the clipboard (Google Images → right-click → Copy image) ----------
  // Where a pasted or picked photo should go right now.
  function photoTarget() {
    if (cropper.open) return null;
    if (picker.open) return pickCb ? (src, by) => { const cb = pickCb; picker.close(); cb(src, by); } : null;
    if (photoEd.open) { const p = byId(photoEd.dataset.id); return (src, by) => { if (setCover(p, src, by)) toast("Photo updated"); }; }
    if (editor.open) return setEditorCover;
    return null;
  }
  async function srcFromClipboardData(dt) {
    const file = [...(dt.files || [])].find(f => f.type.startsWith("image/")) ||
      [...(dt.items || [])].find(i => i.kind === "file" && i.type.startsWith("image/"))?.getAsFile();
    if (file) return { src: fileToSrc(file), revoke: true };
    const html = dt.getData("text/html");
    const m = html && html.match(/<img[^>]+src="([^"]+)"/i);
    const url = m ? m[1].replace(/&amp;/g, "&") : (dt.getData("text/plain") || "").trim();
    if (/^(https?:|data:image\/)/i.test(url)) return { src: await fetchImage(url), revoke: true };
    return null;
  }
  const NO_IMAGE = "No image on the clipboard. In Google Images, right-click a photo → Copy image.";
  function cropAndSend(got, target, by) { openCropper(got.src, out => target(out, by), got.revoke); }
  document.addEventListener("paste", async e => {
    const target = photoTarget();
    if (!target) return;
    const dt = e.clipboardData;
    const hasImage = [...(dt.items || [])].some(i => i.type.startsWith("image/"));
    if (!hasImage && e.target.matches && e.target.matches("input, textarea")) return; // normal text paste into a field
    e.preventDefault();
    try {
      const got = await srcFromClipboardData(dt);
      if (!got) return toast(NO_IMAGE);
      cropAndSend(got, target, { src: "Pasted image" });
    } catch (err) { toast(err.message); }
  });
  // "Paste image" button: works where the browser lets pages read the clipboard (localhost or https).
  const canReadClipboard = !!(navigator.clipboard && navigator.clipboard.read) && window.isSecureContext;
  async function pasteButton() {
    const target = photoTarget();
    if (!target) return;
    try {
      const items = await navigator.clipboard.read();
      for (const it of items) {
        const type = it.types.find(t => t.startsWith("image/"));
        if (type) return cropAndSend({ src: URL.createObjectURL(await it.getType(type)), revoke: true }, target, { src: "Pasted image" });
      }
      for (const it of items) {
        if (!it.types.includes("text/plain")) continue;
        const url = (await (await it.getType("text/plain")).text()).trim();
        if (/^https?:/i.test(url)) return cropAndSend({ src: await fetchImage(url), revoke: true }, target, { src: "Pasted image" });
      }
      toast(NO_IMAGE);
    } catch (err) {
      toast(err.name === "NotAllowedError" ? "Allow clipboard access, or press Ctrl+V (⌘V on Mac)" : err.message);
    }
  }
  const pasteBtnHtml = () => canReadClipboard
    ? `<button class="btn ghost block" type="button" data-paste>${icon.paste}<span>Paste image</span></button>` : "";
  const pasteHint = `<p class="paste-hint">Copied a photo from Google? Press <kbd>Ctrl</kbd>+<kbd>V</kbd> (<kbd>⌘</kbd><kbd>V</kbd> on Mac).</p>`;

  // ---------- admin: product photo ----------
  const photoEd = $("#photo-ed");
  function openPhotoEditor(p) {
    const c = coverOf(p);
    photoEd.dataset.id = p.id;
    photoEd.innerHTML = `<div class="menu-body">
      <h2 id="pe-title">Product photo</h2>
      <p>${esc(p.name)}</p>
      <div class="pe-prev${c && c.vendor ? " is-cover" : ""}">${c ? `<img src="${esc(c.src)}" alt="Current photo of ${esc(p.name)}">` : `<span>${icon.box}</span>`}</div>
      ${c ? `<button class="btn ghost block" type="button" data-pe-crop>${icon.crop}<span>Crop this photo</span></button>` : ""}
      <button class="btn block" type="button" data-pe-search>${icon.search}<span>Search the web</span></button>
      ${pasteBtnHtml()}
      <label class="btn ghost block">${icon.camera}<span>Upload or take a photo</span><input type="file" accept="image/*,.heic,.heif" data-pe-file hidden></label>
      ${pasteHint}
      ${p.coverImg ? `<button class="btn danger block" type="button" data-pe-reset>Go back to the original photo</button>` : ""}
      <button class="btn ghost block" type="button" data-pe-view>See all photos</button>
      <button class="btn ghost block" type="button" data-close>Done</button>
    </div>`;
    if (!photoEd.open) photoEd.showModal();
  }
  function setCover(p, src, by) {
    const before = [p.coverImg, p.coverBy];
    if (src) { p.coverImg = src; p.coverBy = by || null; } else { delete p.coverImg; delete p.coverBy; }
    if (!save()) { [p.coverImg, p.coverBy] = before; return false; }
    if (detail.open && detail.dataset.id === p.id) renderDetail(p);
    refresh();
    if (photoEd.open) openPhotoEditor(p);
    return true;
  }
  photoEd.addEventListener("click", e => {
    const t = e.target.closest("button");
    if (e.target === photoEd) return photoEd.close();
    if (!t) return;
    const p = byId(photoEd.dataset.id);
    if (t.matches("[data-close]")) photoEd.close();
    else if (t.matches("[data-pe-search]")) openPicker(p.name, (src, by) => { if (setCover(p, src, by)) toast("Photo updated"); });
    else if (t.matches("[data-paste]")) pasteButton();
    else if (t.matches("[data-pe-crop]")) {
      const c = coverOf(p);
      openCropper(c.src, out => { if (setCover(p, out, c.by || { src: "Cropped in the app" })) toast("Photo cropped"); });
    }
    else if (t.matches("[data-pe-reset]")) { if (setCover(p, null)) toast("Back to the original photo"); }
    else if (t.matches("[data-pe-view]")) { photoEd.close(); openViewer(p, 0); }
  });
  photoEd.addEventListener("change", e => {
    if (!e.target.matches("[data-pe-file]") || !e.target.files[0]) return;
    const p = byId(photoEd.dataset.id), file = e.target.files[0];
    e.target.value = "";
    fileSrc(file).then(src => openCropper(src, out => { if (setCover(p, out, { src: "Added in the app" })) toast("Photo updated"); }, true), err => toast(err.message));
  });

  // ---------- web photo search ----------
  // Needs server.py (it fetches the search results and images for the page).
  const picker = $("#picker");
  let pickCb = null, pickResults = [], pickSeq = 0;
  function openPicker(query, cb) {
    pickCb = cb;
    picker.innerHTML = `<div class="f-head">
        <button class="icon-btn" type="button" data-close aria-label="Close">${icon.close}</button>
        <h2 id="pk-title">Find a photo</h2>
        ${canReadClipboard ? `<button class="icon-btn" type="button" data-paste aria-label="Paste an image from the clipboard" title="Paste image">${icon.paste}</button>` : `<span style="width:44px"></span>`}
      </div>
      <form class="pk-bar" id="pk-form" role="search">
        <label class="search">${icon.search}<span class="sr">Search the web for photos</span>
          <input id="pk-q" type="search" value="${esc(query)}" placeholder="e.g. 1 inch zip tie mount" autocomplete="off" enterkeyhint="search"></label>
      </form>
      <p class="pk-note" id="pk-note" aria-live="polite"></p>
      <div class="scroll"><div class="pk-grid" id="pk-grid"></div>${pasteHint}</div>`;
    picker.showModal();
    if (query.trim()) runPick(query); else $("#pk-q").focus();
  }
  async function runPick(q) {
    const note = $("#pk-note"), grid = $("#pk-grid"), seq = ++pickSeq;
    note.className = "pk-note busy"; note.innerHTML = `<span class="spinner" aria-hidden="true"></span>Searching for “${esc(q)}”…`;
    grid.innerHTML = Array.from({ length: 8 }, () => `<div class="pk-item ghost"><span class="pk-img"></span></div>`).join("");
    try {
      const r = await fetch(`api/images?q=${encodeURIComponent(q)}`);
      const data = await r.json().catch(() => { throw new Error("nosrv"); });
      if (!r.ok) throw new Error(data.error || "Search failed");
      if (seq !== pickSeq) return;
      pickResults = data.results || [];
      note.className = "pk-note";
      note.textContent = pickResults.length ? "Tap the one that matches the part in the shop. You can crop it next." : "No photos found. Try different words.";
      grid.innerHTML = pickResults.map((x, i) => `<button class="pk-item" type="button" data-pick="${i}">
          <span class="pk-img"><img src="${esc(x.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer"></span>
          <b>${esc(x.title || x.host)}</b><span>${x.store ? `<i class="pk-store">FRC store</i>` : ""}${esc(x.host)}</span></button>`).join("");
    } catch (err) {
      if (seq !== pickSeq) return;
      grid.innerHTML = "";
      note.className = "pk-note err";
      note.innerHTML = err.message === "nosrv" || err instanceof TypeError
        ? `Web search needs the app started with <code>python server.py</code>. You can still paste or upload a photo.`
        : esc(err.message);
    }
  }
  picker.addEventListener("submit", e => { e.preventDefault(); const q = $("#pk-q").value.trim(); if (q) { $("#pk-q").blur(); runPick(q); } });
  picker.addEventListener("click", async e => {
    if (e.target === picker) return picker.close();
    const t = e.target.closest("button"); if (!t) return;
    if (t.matches("[data-close]")) return picker.close();
    if (t.matches("[data-paste]")) return pasteButton();
    if (!t.dataset.pick || picker.classList.contains("busy")) return;
    const x = pickResults[Number(t.dataset.pick)];
    picker.classList.add("busy"); t.classList.add("loading");
    try {
      let src;
      try { src = await fetchImage(x.full); } catch { src = await fetchImage(x.thumb); } // big one blocked → use the preview
      const target = photoTarget();
      if (target) openCropper(src, out => target(out, { src: x.host, url: x.page }), true);
    } catch (err) { toast(err.message); }
    finally { picker.classList.remove("busy"); t.classList.remove("loading"); }
  });

  // ---------- editor ----------
  const editor = $("#editor");
  let pendingPhoto = null;
  let pendingCover = null; // { src, by } picked from the web in the editor
  function setEditorCover(src, by) {
    pendingCover = { src, by };
    const box = $("#e-cover");
    if (!box) return;
    box.hidden = false;
    box.innerHTML = `<span class="cp-img"><img src="${src}" alt=""></span>
      <div><b>Product photo</b><span>${by && by.url ? "from " : ""}${esc(by ? by.src : "")}</span></div>
      <button class="btn ghost" type="button" data-cover-clear>Remove</button>`;
  }

  function renderEditor(p) {
    const isNew = !p;
    p = p || { name: filtered().length ? "" : ui.q.trim(), cat: ui.cat !== "All" ? ui.cat : CATEGORIES[0].name, sub: ui.subs.size === 1 ? [...ui.subs][0] : "", qty: 1, unit: "pcs", min: 0, area: ui.area || AREAS[0].id, spot: "" };
    pendingPhoto = null; pendingCover = null;
    const c = p.id ? coverOf(p) : null;
    const img = c ? c.src : (p.photo || (p.img ? `img/thumb/${p.img}.jpg` : ""));
    editor.innerHTML = `<div class="f-head">
        <button class="icon-btn" type="button" data-close aria-label="Cancel">${icon.close}</button>
        <h2 id="e-title">${isNew ? "New part" : "Edit part"}</h2>
        <span style="width:44px"></span>
      </div>
      <form class="scroll" id="e-form" novalidate>
        <div class="f-body">
          <label class="photo-pick" id="e-pick">
            ${img ? `<img src="${esc(img)}" alt="">` : `<span class="hint">${icon.camera}<b>Add a photo</b><small>Optional: a photo of the part or its bin</small></span>`}
            <input type="file" accept="image/*,.heic,.heif" capture="environment" aria-label="Photo of the part">
          </label>
          <input type="hidden" name="conf" value="${esc(p.conf || "rough")}">
          <div class="name-wrap">
            <label class="field"><span>Name</span><input name="name" required value="${esc(p.name)}" placeholder="e.g. 10-32 × 1/2&quot; bolts" autocomplete="off"></label>
            <button class="btn ghost find-photo" type="button" data-find-photo>${icon.search}<span>Find a photo</span></button>
          </div>
          <div class="cover-pick" id="e-cover" hidden></div>
          <div class="two">
            <label class="field"><span>Category</span><select name="cat">${CATEGORIES.map(c => `<option${c.name === p.cat ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
            <label class="field"><span>Type</span><select name="sub">${subOptions(p.cat, p.sub)}</select></label>
          </div>
          <div class="two">
            <label class="field"><span>Place</span><select name="area">${AREAS.map(a => `<option value="${a.id}"${a.id === p.area ? " selected" : ""}>${esc(a.name)}</option>`).join("")}</select></label>
            <label class="field"><span>Spot</span><input name="spot" value="${esc(p.spot)}" placeholder="e.g. pink bin" autocomplete="off"></label>
          </div>
          <div class="three">
            <label class="field"><span>How many</span><input name="qty" type="number" inputmode="numeric" min="0" value="${p.qty}"></label>
            <label class="field"><span>Unit</span><input name="unit" value="${esc(p.unit)}" autocomplete="off"></label>
            <label class="field"><span>Alert under</span><input name="min" type="number" inputmode="numeric" min="0" value="${p.min}"></label>
          </div>
          <button class="btn block" type="submit">${isNew ? "Add part" : "Save changes"}</button>
          ${isNew ? "" : `<button class="btn danger block" type="button" data-delete>Delete part</button>`}
        </div>
      </form>`;
    editor.dataset.id = isNew ? "" : p.id;
  }

  function subOptions(cat, sel) {
    return subsOf(cat).map(sb => `<option${sb === sel ? " selected" : ""}>${esc(sb)}</option>`).join("");
  }

  // iPhone HEIC photos don't open in Chrome/Edge on Windows; server.py turns them into JPEGs.
  const converted = new WeakMap();
  function toJpeg(file) {
    if (!converted.has(file)) converted.set(file, (async () => {
      let r;
      try { r = await fetch("api/convert", { method: "POST", body: file }); }
      catch { throw new Error("This browser can't open that photo type. Start the app with python server.py, or use a JPG."); }
      if (!r.ok) { let m = "Couldn't open that photo"; try { m = (await r.json()).error || m; } catch { m = "This browser can't open that photo type. Start the app with python server.py, or use a JPG."; } throw new Error(m); }
      return new File([await r.blob()], "photo.jpg", { type: "image/jpeg" });
    })());
    return converted.get(file);
  }
  const looksHeic = f => /hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name || "");
  async function resizeImage(file, max = 900, quality = 0.72) {
    if (looksHeic(file)) file = await toJpeg(file);
    try { return await resizeImageRaw(file, max, quality); }
    catch { return resizeImageRaw(await toJpeg(file), max, quality); }
  }
  async function fileSrc(file) {
    if (looksHeic(file)) file = await toJpeg(file);
    return URL.createObjectURL(file);
  }
  function resizeImageRaw(file, max = 900, quality = 0.72) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onerror = rej;
      r.onload = () => {
        const im = new Image();
        im.onerror = () => rej(new Error("Couldn't open that photo"));
        im.onload = () => {
          const s = Math.min(1, max / Math.max(im.width, im.height));
          const c = document.createElement("canvas");
          c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
          c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
          res(c.toDataURL("image/jpeg", quality));
        };
        im.src = r.result;
      };
      r.readAsDataURL(file);
    });
  }

  editor.addEventListener("change", async e => {
    if (e.target.name === "cat") { e.target.form.sub.innerHTML = subOptions(e.target.value); return; }
    if (e.target.type !== "file" || !e.target.files[0]) return;
    const file = e.target.files[0];
    try {
      pendingPhoto = await resizeImage(file);
      const pick = $("#e-pick");
      pick.querySelector("img, .hint")?.remove();
      pick.insertAdjacentHTML("afterbegin", `<img src="${pendingPhoto}" alt="">`);
    } catch { toast("Couldn't read that photo"); return; }
  });

  editor.addEventListener("input", e => e.target.closest(".field")?.classList.remove("ai-filled"));

  editor.addEventListener("click", e => {
    const t = e.target.closest("button");
    if (e.target === editor) return closeRoute();
    if (!t) return;
    if (t.matches("[data-close]")) closeRoute();
    else if (t.matches("[data-find-photo]")) {
      const name = $("#e-form").elements.name.value.trim();
      openPicker(name, setEditorCover);
    }
    else if (t.matches("[data-cover-clear]")) { pendingCover = null; $("#e-cover").hidden = true; }
    else if (t.matches("[data-delete]")) {
      const p = byId(editor.dataset.id);
      if (armed(t, `Tap again to delete “${p.name}”`)) deletePart(p);
    }
  });

  // Two-tap confirm: the first tap arms the button for a few seconds.
  function armed(btn, label) {
    if (btn.classList.contains("armed")) return true;
    const old = btn.innerHTML;
    btn.classList.add("armed"); btn.textContent = label;
    setTimeout(() => { if (btn.isConnected) { btn.classList.remove("armed"); btn.innerHTML = old; } }, 4000);
    return false;
  }
  function deletePart(p) {
    parts = parts.filter(o => o !== p);
    if (SEED_PARTS.some(x => x.id === p.id)) deleted.add(p.id);
    if (!save()) return;
    closeDialogs(null);
    refresh(); toast(`Deleted “${p.name}”`); go(base, true);
  }

  editor.addEventListener("submit", e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const name = String(f.get("name")).trim();
    if (!name) { e.target.name.focus(); toast("Give the part a name"); return; }
    const vals = {
      name, cat: f.get("cat"), sub: f.get("sub"), area: f.get("area"), spot: String(f.get("spot")).trim(),
      qty: Math.max(0, parseInt(f.get("qty"), 10) || 0), unit: String(f.get("unit")).trim() || "pcs",
      min: Math.max(0, parseInt(f.get("min"), 10) || 0), conf: f.get("conf") || "rough", reported: new Date().toISOString(), source: "count"
    };
    let p = byId(editor.dataset.id);
    if (p) { if (p.name !== vals.name) vals.nameEdited = true; if (p.area !== vals.area || p.spot !== vals.spot) vals.placeEdited = true; Object.assign(p, vals); }
    else { p = { id: "u-" + Date.now().toString(36), ...vals }; parts.unshift(p); }
    if (pendingPhoto) (p.extra = p.extra || []).push({ src: pendingPhoto, date: new Date().toISOString() });
    if (pendingCover) { p.coverImg = pendingCover.src; p.coverBy = pendingCover.by; }
    if (!save()) return;
    refresh();
    toast(editor.dataset.id ? "Changes saved" : "Part added");
    go(`#/part/${encodeURIComponent(p.id)}`, true);
  });

  // ---------- menu ----------
  const menu = $("#menu");
  function renderMenu() {
    const th = localStorage.getItem(THEME_KEY) || "auto";
    menu.innerHTML = `<div class="menu-body">
      <h2 id="m-title">Settings</h2>
      <p>Everything saves on this device only. No login yet.</p>
      <label class="toggle"><input type="checkbox" id="m-admin"${isAdmin() ? " checked" : ""}>
        <span><b>Admin mode</b><small>Tap a part's photo to change it or search the web for a better one</small></span></label>
      <div class="seg" role="group" aria-label="Theme">${["auto", "light", "dark"].map(t => `<button type="button" data-theme-set="${t}" aria-pressed="${t === th}">${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}</div>
      <button class="btn ghost block" type="button" data-export>Download data (JSON)</button>
      <button class="btn danger block" type="button" data-reset>Reset to photo data</button>
      <button class="btn block" type="button" data-close>Done</button>
    </div>`;
  }
  $("#menu-btn").addEventListener("click", () => { renderMenu(); menu.showModal(); });
  menu.addEventListener("change", e => {
    if (e.target.id === "m-admin") {
      try { e.target.checked ? localStorage.setItem(ADMIN_KEY, "1") : localStorage.removeItem(ADMIN_KEY); } catch {}
      toast(e.target.checked ? "Admin mode on: tap a part's photo to change it" : "Admin mode off");
      if (detail.open) renderDetail(byId(detail.dataset.id));
      return;
    }
  });
  menu.addEventListener("click", e => {
    const t = e.target.closest("button");
    if (e.target === menu) return menu.close();
    if (!t) return;
    if (t.matches("[data-close]")) menu.close();
    else if (t.dataset.themeSet) { setTheme(t.dataset.themeSet); renderMenu(); }
    else if (t.matches("[data-export]")) {
      const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), parts }, null, 2)], { type: "application/json" });
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "frc-inventory.json" });
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } else if (t.matches("[data-reset]")) {
      if (!armed(t, "Tap again: this erases every count and edit")) return;
      parts = seed(); deleted.clear(); save(); refresh(); menu.close(); toast("Reset to photo data");
    }
  });
  function setTheme(t) {
    if (t === "auto") { localStorage.removeItem(THEME_KEY); delete document.documentElement.dataset.theme; }
    else { localStorage.setItem(THEME_KEY, t); document.documentElement.dataset.theme = t; }
  }
  try { const t = localStorage.getItem(THEME_KEY); if (t) document.documentElement.dataset.theme = t; } catch {}

  // ---------- toast ----------
  let toastTimer;
  function toast(msg) {
    const el = $("#toast"); el.textContent = msg; el.classList.add("on");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("on"), 2200);
  }

  // ---------- routing ----------
  let base = "#/";
  let depth = 0; // dialog routes pushed on top of base

  function go(hash, replace = false) {
    if (replace) { history.replaceState(null, "", hash); route(depth === 0 ? true : undefined); }
    else location.hash = hash;
  }
  function closeRoute() {
    if (depth > 0 && history.length > 1) history.back();
    else go(base, true);
  }
  function closeDialogs(except) {
    [detail, editor, viewer, menu, photoEd, picker, cropper].forEach(d => {
      if (d !== except && d.open) d.close();
    });
  }
  [detail, editor].forEach(d => d.addEventListener("cancel", e => { e.preventDefault(); closeRoute(); }));

  function showTab(tab) {
    ["library", "places", "low"].forEach(v => { $(`#view-${v}`).hidden = v !== tab; });
    document.querySelectorAll(".dock a[data-tab]").forEach(a => a.dataset.tab === tab ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
  }

  function route(init) {
    const h = location.hash || "#/";
    const [, a, b] = h.split("/");
    const id = b && decodeURIComponent(b);

    if (a === "part" || a === "edit" || a === "add") {
      if (a === "part") {
        const p = byId(id);
        if (!p) return go(base, true);
        closeDialogs(detail);
        renderDetail(p);
        if (!detail.open) detail.showModal();
        detail.querySelector(".scroll").scrollTop = 0;
      } else {
        const p = a === "edit" ? byId(id) : null;
        if (a === "edit" && !p) return go(base, true);
        closeDialogs(editor);
        renderEditor(p);
        if (!editor.open) editor.showModal();
      }
      if (init !== true) depth++;
      if (!document.querySelector(".view:not([hidden])")) showTab("library");
      return;
    }

    closeDialogs(null);
    depth = 0;
    if (a === "places") { base = h; showTab("places"); renderPlaces(); }
    else if (a === "low") { base = h; showTab("low"); renderLow(); }
    else if (a === "area" && areaById[id]) {
      base = h; ui.area = id; ui.cat = "All"; ui.subs.clear(); showTab("library"); renderLibrary(); window.scrollTo(0, 0);
    } else {
      base = "#/"; ui.area = null;
      showTab("library"); renderLibrary();
    }
  }

  function refresh() {
    renderLibrary();
    if (!$("#view-places").hidden) renderPlaces();
    if (!$("#view-low").hidden) renderLow();
  }

  // ---------- events ----------
  const q = $("#q");
  let qTimer;
  q.addEventListener("input", () => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => { ui.q = q.value; renderLibrary(); }, 80);
  });
  q.addEventListener("keydown", e => {
    if (e.key === "Enter") { const first = $("#grid .card"); if (first) { q.blur(); go(first.getAttribute("href")); } }
    if (e.key === "Escape") { q.value = ""; ui.q = ""; renderLibrary(); }
  });
  $("#q-clear").addEventListener("click", () => { q.value = ""; ui.q = ""; renderLibrary(); q.focus(); });
  $("#chips").addEventListener("click", e => {
    const c = e.target.closest(".chip"); if (!c) return;
    if (ui.cat !== c.dataset.cat) ui.subs.clear();
    ui.cat = c.dataset.cat; renderLibrary();
  });
  $("#area-filter").addEventListener("click", e => {
    if (!e.target.closest("#area-clear")) return;
    ui.area = null; go("#/", true);
  });
  $("#empty-add").addEventListener("click", () => go("#/add"));
  document.addEventListener("keydown", e => {
    if (e.key === "/" && document.activeElement !== q && !document.querySelector("dialog[open]")) { e.preventDefault(); showTab("library"); q.focus(); }
  });
  window.addEventListener("hashchange", () => route());

  route(true);
})();
