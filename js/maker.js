// THE CYANOTYPE NETWORK · maker.js — shared maker space for the tool pages
// One way in for every tool (your prints, camera, file, recent), a tray of
// recent images kept on this device, and the one-screen phone editor.
// Nothing here uploads anything: images stay in this browser's own storage.
(function () {
  "use strict";

  // ---------------------------------------------------------------- tray
  // IndexedDB on this device, one tray per Network account (keyed by the
  // signed-in account's id; tools opened outside the app get a separate
  // "guest" tray). Keeps the 8 most recently used images, each with
  // the settings every tool last used on it. Falls back to memory if the
  // browser won't allow storage (private windows, some iframes).
  var MAX = 8, mem = { images: {}, meta: {} }, dbp = null;

  function openDB() {
    if (dbp) return dbp;
    dbp = new Promise(function (res) {
      try {
        var a = app(), owner = a ? String(a.DB.uid()).replace(/[^\w-]/g, "") : "guest";
        var rq = indexedDB.open("tcn-maker-" + owner, 1);
        rq.onupgradeneeded = function () {
          var d = rq.result;
          if (!d.objectStoreNames.contains("images")) d.createObjectStore("images", { keyPath: "id" });
          if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta", { keyPath: "k" });
        };
        rq.onsuccess = function () { res(rq.result); };
        rq.onerror = function () { res(null); };
        rq.onblocked = function () { res(null); };
      } catch (e) { res(null); }
    });
    return dbp;
  }
  function un(o) { return o && o._v !== undefined ? o._v : o; }
  function tx(store, mode, fn) {
    return openDB().then(function (d) {
      if (!d) return un(fn(null));
      return new Promise(function (res, rej) {
        var t, s;
        try { t = d.transaction(store, mode); s = t.objectStore(store); } catch (e) { return res(un(fn(null))); }
        var out = fn(s);
        t.oncomplete = function () { res(un(out)); };
        t.onerror = function () { rej(t.error); };
      });
    }).catch(function () { return un(fn(null)); });
  }
  function req(r) { var box = {}; r.onsuccess = function () { box._v = r.result; }; return box; }

  var Tray = {
    get: function (id) {
      return tx("images", "readonly", function (s) { return s ? req(s.get(id)) : { _v: mem.images[id] }; });
    },
    list: function () {
      return tx("images", "readonly", function (s) { return s ? req(s.getAll()) : { _v: Object.values(mem.images) }; })
        .then(function (a) { return (a || []).sort(function (x, y) { return y.used - x.used; }); });
    },
    save: function (rec) {
      return tx("images", "readwrite", function (s) { if (s) s.put(rec); else mem.images[rec.id] = rec; return { _v: rec }; });
    },
    remove: function (id) {
      return tx("images", "readwrite", function (s) { if (s) s.delete(id); else delete mem.images[id]; return { _v: true }; });
    },
    meta: function (k, v) {
      if (v === undefined) return tx("meta", "readonly", function (s) { return s ? req(s.get(k)) : { _v: mem.meta[k] }; })
        .then(function (r) { return r ? r.v : null; });
      return tx("meta", "readwrite", function (s) { var r = { k: k, v: v }; if (s) s.put(r); else mem.meta[k] = r; return { _v: v }; });
    },
    clear: function () {
      return Promise.all([
        tx("images", "readwrite", function (s) { if (s) s.clear(); mem.images = {}; return { _v: true }; }),
        tx("meta", "readwrite", function (s) { if (s) s.clear(); mem.meta = {}; return { _v: true }; })
      ]);
    },
    // Adds an image (or finds the same one already in the tray) and returns its record.
    add: function (blob, name, key) {
      key = key || ("file:" + name + ":" + blob.size);
      return Tray.list().then(function (all) {
        var hit = all.filter(function (r) { return r.key === key; })[0];
        if (hit) { hit.used = Date.now(); return Tray.save(hit); }
        return thumb(blob).then(function (t) {
          var rec = { id: "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            key: key, name: name || "image", type: blob.type, size: blob.size, blob: blob,
            thumb: t.url, w: t.w, h: t.h, added: Date.now(), used: Date.now(), states: {} };
          return Tray.save(rec).then(function () {
            var extra = all.slice(MAX - 1);   // keep the newest MAX including this one
            return Promise.all(extra.map(function (r) { return Tray.remove(r.id); })).then(function () { return rec; });
          });
        });
      });
    }
  };

  function decode(blob) {
    if (window.createImageBitmap) return createImageBitmap(blob).catch(function () { return viaImg(blob); });
    return viaImg(blob);
  }
  function viaImg(blob) {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(blob), im = new Image();
      im.onload = function () { URL.revokeObjectURL(u); res(im); };
      im.onerror = function () { URL.revokeObjectURL(u); rej(new Error("decode")); };
      im.src = u;
    });
  }
  function thumb(blob) {
    return decode(blob).then(function (im) {
      var w = im.width || im.naturalWidth, h = im.height || im.naturalHeight, s = 220 / Math.max(w, h);
      var c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      return { url: c.toDataURL("image/jpeg", 0.8), w: w, h: h };
    }).catch(function () { return { url: "", w: 0, h: 0 }; });
  }

  // ------------------------------------------------------- the Network app
  // When framed inside the app, reach its signed-in Supabase client.
  function app() {
    try {
      if (window.parent === window) return null;
      return window.parent.Function(
        "return (typeof sb !== 'undefined' && typeof DB !== 'undefined' && DB.uid && DB.uid()) ? { sb: sb, DB: DB } : null;")();
    } catch (e) { return null; }
  }

  // ------------------------------------------------------------- helpers
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var coarse = window.matchMedia ? window.matchMedia("(pointer:coarse)").matches : false;

  var ICON = {
    prints: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="13" height="17" rx="1.5"/><path d="M6.5 16l3-3.5 2.2 2.4 1.6-1.6 2.2 2.7"/><circle cx="18" cy="18" r="3.4"/><circle cx="18" cy="17" r="1"/></svg>',
    camera: '<svg viewBox="0 0 24 24"><path d="M3 8.5a2 2 0 0 1 2-2h2.2l1.6-2.2h6.4l1.6 2.2H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.8"/></svg>',
    file: '<svg viewBox="0 0 24 24"><path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/><path d="M9 16l2.2-2.6 1.6 1.8 1.2-1.2 1.6 2"/></svg>',
    recent: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>'
  };

  // ---------------------------------------------------------------- Maker
  var Maker = {
    Tray: Tray,
    opts: null,
    current: null,     // tray record in use
    _saveT: 0,

    // opts: tool, label, multiple, onImage(blob, info) -> Promise|void,
    //       getState() -> object, chipHost (element), accept
    init: function (opts) {
      Maker.opts = opts;
      buildSheet();
      wireDropPaste();
      // A tool that juggles several images restores itself.
      if (opts.restore) {
        return Promise.resolve(opts.restore()).then(function (ok) { if (!ok) Maker.openStart(false); else Maker.refit(); })
          .catch(function () { Maker.openStart(false); });
      }
      // Re-open whatever this tool had loaded last time, with its settings.
      return Tray.meta("last:" + opts.tool).then(function (id) {
        if (!id) { Maker.openStart(false); return; }
        return Tray.get(id).then(function (rec) {
          if (!rec) { Maker.openStart(false); return; }
          return Maker.use(rec, true);
        });
      }).catch(function () { Maker.openStart(false); });
    },

    // Hand a tray record to the tool.
    use: function (rec, restoring) {
      var o = Maker.opts;
      Maker.current = rec;
      rec.used = Date.now();
      Tray.save(rec);
      Tray.meta("last:" + o.tool, rec.id);
      Maker.closeStart();
      renderChip();
      var state = rec.states && rec.states[o.tool] || null;
      return Promise.resolve(o.onImage(rec.blob, { name: rec.name, state: state, restoring: !!restoring, id: rec.id }))
        .then(function () { Maker.refit(); })
        .catch(function (e) { console.error(e); Maker.toast("Couldn’t open that image. Try a JPEG or PNG."); Maker.openStart(false); });
    },

    addBlob: function (blob, name, key) {
      if (!blob) return;
      Maker.busy(true);
      return Tray.add(blob, name, key).then(function (rec) { Maker.busy(false); return Maker.use(rec, false); })
        .catch(function () { Maker.busy(false); Maker.toast("Couldn’t keep that image on this device."); });
    },

    // Tools call this whenever settings change; saved a moment later.
    saveState: function () {
      clearTimeout(Maker._saveT);
      Maker._saveT = setTimeout(function () {
        var o = Maker.opts, rec = Maker.current;
        if (!o || !rec || !o.getState) return;
        try {
          var s = o.getState();
          rec.states = rec.states || {};
          rec.states[o.tool] = JSON.parse(JSON.stringify(s));
          Tray.save(rec);
        } catch (e) {}
      }, 400);
    },

    openStart: function (closable) {
      var sh = document.getElementById("mkStart");
      if (!sh) return;
      sh.classList.toggle("closable", !!closable);
      sh.hidden = false;
      document.documentElement.classList.add("mk-start-open");
      fillRecent();
      fillPrints();
    },
    closeStart: function () {
      var sh = document.getElementById("mkStart");
      if (sh) sh.hidden = true;
      document.documentElement.classList.remove("mk-start-open");
    },
    // Usage count for the TCN sheet: tool, action, format and size only.
    // No images, names or account details. A repeat of the same download counts once.
    // Never blocks or delays the download; failures are ignored.
    track: function (tool, action, format, size) {
      try {
        var key = [tool, action, format, size, Maker.current ? Maker.current.id : ""].join("|");
        if (key === Maker._lastTrack) return;
        Maker._lastTrack = key;
        var tz = ""; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
        fetch("https://script.google.com/macros/s/AKfycbwY8z3PHjGxa3NaMYpSUH6iPnRLGJnlKd2x0Ku9Nsd_h_N8CTEtbqnUQx8ya7Ll2oQvPA/exec", {
          method: "POST", mode: "no-cors", keepalive: true,
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ tool: tool, action: action, format: String(format || ""), size: String(size || ""),
                                 language: navigator.language || "", timeZone: tz })
        }).catch(function () {});
      } catch (e) {}
    },
    // Re-measure the phone layout after a tool's content changes size.
    refit: function () { if (Maker._editor) setTimeout(Maker._editor.refit, 30); },
    busy: function (on) {
      var sh = document.getElementById("mkStart");
      if (sh) sh.classList.toggle("busy", !!on);
    },
    toast: function (msg) {
      var t = document.getElementById("mkToast");
      if (!t) { t = el("div", "mk-toast"); t.id = "mkToast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
      t.textContent = msg; t.classList.add("on");
      clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove("on"); }, 3200);
    },

    // ------------------------------------------------- phone editor layout
    // cfg: stage (element, or list of elements, kept in view), panels [{title, nodes:[el]}],
    //      actions [el], hide [el] (only hidden on phones), query (media query for phone
    //      layout), onTab(i) when the visible panel changes, onLayout(isPhone)
    editor: function (cfg) {
      var mq = window.matchMedia(cfg.query || "(max-width: 760px)");
      var marks = [];          // where every moved node came from
      var root = null, track = null, tabs = null, active = 0;

      function mark(node) { var c = document.createComment("mk"); node.parentNode.insertBefore(c, node); marks.push([c, node]); }
      function build() {
        root = el("div", "mk-phone"); root.id = "mkPhone";
        var stage = el("div", "mk-stage");
        // One toolbar row on every tool: view switcher on the left, the image chip on the right.
        if ((cfg.toolbar && cfg.toolbar.length) || cfg.chip) {
          var bar = el("div", "mk-bar"), left = el("div", "mk-bar-l");
          (cfg.toolbar || []).forEach(function (n) { if (n) { mark(n); left.appendChild(n); } });
          bar.appendChild(left);
          if (cfg.chip) { mark(cfg.chip); bar.appendChild(cfg.chip); }
          stage.appendChild(bar);
        }
        var view = el("div", "mk-view");
        [].concat(cfg.stage).forEach(function (n) { if (n) { mark(n); view.appendChild(n); } });
        stage.appendChild(view);
        tabs = el("div", "mk-tabs"); tabs.setAttribute("role", "tablist");
        track = el("div", "mk-track");
        cfg.panels.forEach(function (p, i) {
          var b = el("button", "mk-tab" + (i === 0 ? " on" : ""), esc(p.title));
          b.type = "button"; b.setAttribute("role", "tab");
          b.onclick = function () { go(i, true); };
          tabs.appendChild(b);
          var sec = el("section", "mk-panel"); sec.setAttribute("aria-label", p.title);
          p.nodes.forEach(function (n) { if (n) { mark(n); sec.appendChild(n); } });
          track.appendChild(sec);
        });
        var acts = el("div", "mk-actions");
        (cfg.actions || []).forEach(function (n) { if (n) { mark(n); acts.appendChild(n); } });
        root.appendChild(stage); root.appendChild(tabs); root.appendChild(track); root.appendChild(acts);
        document.body.appendChild(root);
        (cfg.hide || []).forEach(function (n) { if (n) n.classList.add("mk-hidden"); });
        document.documentElement.classList.add("mk-on");
        var t = 0;
        track.addEventListener("scroll", function () {
          clearTimeout(t);
          t = setTimeout(function () { var i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth)); setTab(i); }, 60);
        }, { passive: true });
        go(active, false);
        sizeStage();
      }
      function teardown() {
        if (!root) return;
        for (var i = marks.length - 1; i >= 0; i--) { var m = marks[i]; m[0].parentNode.insertBefore(m[1], m[0]); m[0].remove(); }
        marks = [];
        (cfg.hide || []).forEach(function (n) { if (n) n.classList.remove("mk-hidden"); });
        root.remove(); root = null;
        document.documentElement.classList.remove("mk-on");
        if (cfg.onLayout) cfg.onLayout(false);
      }
      function setTab(i) {
        var changed = active !== i;
        active = i;
        document.documentElement.setAttribute("data-mk-tab", i);
        if (cfg.onTab && (changed || !setTab._once)) { setTab._once = true; cfg.onTab(i); }
        Array.prototype.forEach.call(tabs.children, function (b, k) { b.classList.toggle("on", k === i); b.setAttribute("aria-selected", k === i); });
        var b = tabs.children[i];
        if (b) tabs.scrollTo({ left: b.offsetLeft - (tabs.clientWidth - b.offsetWidth) / 2, behavior: "smooth" });
      }
      function go(i, smooth) {
        setTab(i);
        track.scrollTo({ left: i * track.clientWidth, behavior: smooth ? "smooth" : "auto" });
      }
      // Panels get exactly the height their tallest content needs (within limits),
      // and the preview takes everything else, so neither has dead space.
      function fitTrack() {
        var tallest = 0;
        Array.prototype.forEach.call(track.children, function (sec) {
          var kids = sec.children, h = 0;
          for (var k = 0; k < kids.length; k++) if (kids[k].offsetParent !== null || kids[k].getClientRects().length) h = Math.max(h, kids[k].offsetTop + kids[k].offsetHeight);
          tallest = Math.max(tallest, h);
        });
        var pad = 16, H = root.clientHeight;
        var want = Math.max(120, Math.min(tallest + pad, Math.round(H * 0.38)));
        track.style.height = want + "px";
      }
      function sizeStage() {
        if (!root) return;
        fitTrack();
        var st = root.querySelector(".mk-view");
        document.documentElement.style.setProperty("--mk-stage-h", st.clientHeight + "px");
        if (cfg.onLayout) cfg.onLayout(true);
      }
      function apply() { if (mq.matches) { if (!root) build(); else sizeStage(); } else teardown(); }
      if (mq.addEventListener) mq.addEventListener("change", apply); else mq.addListener(apply);
      window.addEventListener("resize", function () { if (root) { sizeStage(); go(active, false); } });
      apply();
      var api = { go: go, isPhone: function () { return !!root; }, tab: function () { return active; },
        refit: function () { if (root) { sizeStage(); go(active, false); } } };
      Maker._editor = api;
      return api;
    }
  };

  // ---------------------------------------------------------- start sheet
  function buildSheet() {
    var o = Maker.opts;
    var sh = el("div", "mk-start"); sh.id = "mkStart"; sh.hidden = true;
    sh.setAttribute("role", "dialog"); sh.setAttribute("aria-label", "Start with an image");
    sh.innerHTML =
      '<div class="mk-card">' +
        '<div class="mk-head"><div><div class="mk-kicker">' + esc(o.label || "") + '</div><h2>Start with an image</h2></div>' +
        '<button type="button" class="mk-x" aria-label="Close">✕</button></div>' +
        '<div class="mk-group" id="mkRecentG" hidden><div class="mk-gh">' + ICON.recent + '<b>Recent on this device</b><button type="button" class="mk-link" id="mkClear">Clear</button></div>' +
          '<div class="mk-strip" id="mkRecent"></div></div>' +
        '<div class="mk-group" id="mkPrintsG" hidden><div class="mk-gh">' + ICON.prints + '<b>From your prints</b></div>' +
          '<div class="mk-strip" id="mkPrints"></div></div>' +
        '<div class="mk-opts">' +
          (coarse ? '<label class="mk-opt">' + ICON.camera + '<span><b>Take a photo</b><small>Opens the camera</small></span>' +
            '<input type="file" accept="image/*" capture="environment" id="mkCam" hidden></label>' : '') +
          '<label class="mk-opt">' + ICON.file + '<span><b>Choose a file</b><small>' +
            (coarse ? 'Photos or Files' : 'Or drop / paste an image anywhere on this page') + '</small></span>' +
            '<input type="file" accept="' + (o.accept || "image/*") + '" id="mkFile" hidden' + (o.multiple ? " multiple" : "") + '></label>' +
        '</div>' +
        '<p class="mk-note">Images stay on this device. Nothing is uploaded.</p>' +
        '<div class="mk-spin" aria-hidden="true"></div>' +
      '</div>';
    document.body.appendChild(sh);
    function has() { return o.hasImage ? o.hasImage() : !!Maker.current; }
    sh.querySelector(".mk-x").onclick = function () { if (has()) Maker.closeStart(); };
    sh.addEventListener("click", function (e) { if (e.target === sh && has()) Maker.closeStart(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && has()) Maker.closeStart(); });
    function pick(inp) {
      if (!inp) return;
      inp.onchange = function () {
        var fs = Array.prototype.slice.call(inp.files || []);
        inp.value = "";
        if (!fs.length) return;
        if (o.multiple && o.onFiles && fs.length > 1) { o.onFiles(fs); Maker.closeStart(); return; }
        Maker.addBlob(fs[0], fs[0].name);
      };
    }
    pick(sh.querySelector("#mkFile")); pick(sh.querySelector("#mkCam"));
    sh.querySelector("#mkClear").onclick = function () {
      Tray.clear().then(function () {
        if (Maker.current) { Tray.save(Maker.current); Tray.meta("last:" + o.tool, Maker.current.id); }
        fillRecent();
      });
    };
  }

  function fillRecent() {
    Tray.list().then(function (all) {
      // Posted prints are finished work: only tools that document them (Gallery Bench) offer them.
      if (Maker.opts && Maker.opts.prints === false) all = all.filter(function (r) { return String(r.key || "").indexOf("print:") !== 0; });
      var g = document.getElementById("mkRecentG"), s = document.getElementById("mkRecent");
      if (!g) return;
      g.hidden = !all.length;
      s.innerHTML = "";
      all.forEach(function (r) {
        var b = el("button", "mk-th" + (Maker.current && Maker.current.id === r.id ? " cur" : ""));
        b.type = "button"; b.title = r.name;
        b.innerHTML = (r.thumb ? '<img alt="" src="' + r.thumb + '">' : '<span>' + esc(r.name) + '</span>') + '<i>' + esc(r.name) + '</i>';
        b.onclick = function () { Maker.use(r, false); };
        s.appendChild(b);
      });
    });
  }

  var printsLoaded = false;
  function fillPrints() {
    if (printsLoaded || (Maker.opts && Maker.opts.prints === false)) return;
    var a = app();
    if (!a) return;
    printsLoaded = true;
    a.sb.from("prints").select("id,title,image_path").eq("owner", a.DB.uid())
      .order("created_at", { ascending: false }).limit(24)
      .then(function (r) {
        var rows = (r && r.data) || [];
        if (!rows.length) return;
        return a.DB.signMany(rows.map(function (p) { return p.image_path; })).then(function (urls) {
          var g = document.getElementById("mkPrintsG"), s = document.getElementById("mkPrints");
          g.hidden = false; s.innerHTML = "";
          rows.forEach(function (p) {
            var u = urls[p.image_path]; if (!u) return;
            var b = el("button", "mk-th"); b.type = "button"; b.title = p.title || "Print";
            b.innerHTML = '<img alt="" loading="lazy" src="' + esc(u) + '"><i>' + esc(p.title || "Print") + '</i>';
            b.onclick = function () {
              Maker.busy(true);
              fetch(u).then(function (x) { if (!x.ok) throw 0; return x.blob(); })
                .then(function (blob) { Maker.busy(false); Maker.addBlob(blob, p.title || "Print", "print:" + p.id); })
                .catch(function () { Maker.busy(false); Maker.toast("Couldn’t load that print. Try again."); });
            };
            s.appendChild(b);
          });
        });
      }).catch(function () { printsLoaded = false; });
  }

  // Tools with several images set their own chip text ("3 photos · Add").
  Maker.setChip = function (label, thumbUrl, action) {
    var host = Maker.opts && Maker.opts.chipHost; if (!host) return;
    var c = host.querySelector(".mk-chip");
    if (!c) { c = el("button", "mk-chip"); c.type = "button"; host.appendChild(c); c.onclick = function () { Maker.openStart(true); }; }
    c.innerHTML = (thumbUrl ? '<img alt="" src="' + thumbUrl + '">' : '') + '<span>' + esc(label) + '</span><b>' + esc(action || "Change") + '</b>';
  };
  // Keep an image in the tray without opening it (used for multi-photo picks).
  Maker.keep = function (blob, name, key) { return Tray.add(blob, name, key); };
  function renderChip() {
    var o = Maker.opts, host = o.chipHost, rec = Maker.current;
    if (!host || !rec || o.restore) return;
    var c = host.querySelector(".mk-chip");
    if (!c) { c = el("button", "mk-chip"); c.type = "button"; host.appendChild(c); c.onclick = function () { Maker.openStart(true); }; }
    c.innerHTML = (rec.thumb ? '<img alt="" src="' + rec.thumb + '">' : '') + '<span>' + esc(rec.name) + '</span><b>Change</b>';
    c.title = "Change image";
  }

  function wireDropPaste() {
    var o = Maker.opts, depth = 0;
    function files(dt) { return Array.prototype.slice.call((dt && dt.files) || []).filter(function (f) { return /^image\//.test(f.type) || /\.(heic|heif|tif|tiff)$/i.test(f.name); }); }
    document.addEventListener("dragenter", function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") >= 0) { depth++; document.documentElement.classList.add("mk-drag"); } });
    document.addEventListener("dragleave", function () { depth = Math.max(0, depth - 1); if (!depth) document.documentElement.classList.remove("mk-drag"); });
    document.addEventListener("dragover", function (e) { e.preventDefault(); });
    document.addEventListener("drop", function (e) {
      e.preventDefault(); depth = 0; document.documentElement.classList.remove("mk-drag");
      var fs = files(e.dataTransfer); if (!fs.length) return;
      if (o.multiple && o.onFiles && fs.length > 1) { o.onFiles(fs); Maker.closeStart(); return; }
      Maker.addBlob(fs[0], fs[0].name);
    });
    document.addEventListener("paste", function (e) {
      var t = e.target; if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      var fs = files(e.clipboardData); if (!fs.length) return;
      e.preventDefault(); Maker.addBlob(fs[0], fs[0].name && fs[0].name !== "image.png" ? fs[0].name : "Pasted image");
    });
  }

  window.Maker = Maker;
})();
