// THE CYANOTYPE NETWORK · shell.js — header menus, phone tab bar, UV chip, account initial
const Shell = {
  TOOL_ROUTES: ["negatives", "cmyk", "enlarger", "forecast", "gallerybench", "tags"],
  _uv: null,          // { key, at, html } cached UV chip content
  _prevRoute: null,
  _initial: null,

  init() {
    // Any element with data-nav goes to that route.
    document.querySelectorAll("[data-nav]").forEach(b => {
      b.addEventListener("click", () => {
        Shell.closeAll();
        Router.go(b.dataset.nav);
      });
    });

    // Desktop dropdowns (Tools, Learn)
    document.querySelectorAll(".menu-btn").forEach(btn => {
      const dd = document.getElementById(btn.getAttribute("aria-controls"));
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = dd.hidden;
        Shell.closeAll();
        dd.hidden = !open;
        btn.setAttribute("aria-expanded", String(open));
      });
      dd.querySelectorAll("a").forEach(a => a.addEventListener("click", () => Shell.closeAll()));
    });

    // Phone "More" sheet
    const more = document.getElementById("moreBtn");
    more.addEventListener("click", (e) => {
      e.stopPropagation();
      const sheet = document.getElementById("moreSheet");
      const open = sheet.hidden;
      Shell.closeAll();
      sheet.hidden = !open;
      document.getElementById("sheetBackdrop").hidden = !open;
      more.setAttribute("aria-expanded", String(open));
      more.classList.toggle("active", open);
    });
    document.getElementById("sheetBackdrop").addEventListener("click", () => Shell.closeAll());
    document.querySelectorAll("#moreSheet a").forEach(a => a.addEventListener("click", () => Shell.closeAll()));

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".menu")) Shell.closeDropdowns();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") Shell.closeAll(); });
  },

  closeDropdowns() {
    document.querySelectorAll(".dropdown").forEach(d => { d.hidden = true; });
    document.querySelectorAll(".menu-btn").forEach(b => b.setAttribute("aria-expanded", "false"));
  },

  closeAll() {
    Shell.closeDropdowns();
    const sheet = document.getElementById("moreSheet");
    if (sheet) sheet.hidden = true;
    const bd = document.getElementById("sheetBackdrop");
    if (bd) bd.hidden = true;
    const more = document.getElementById("moreBtn");
    if (more) { more.setAttribute("aria-expanded", "false"); more.classList.remove("active"); }
  },

  signedOut() {
    Shell.closeAll();
    ["mainNav", "topRight", "tabBar"].forEach(id => { document.getElementById(id).hidden = true; });
    document.body.classList.remove("signed-in");
    Shell._uv = null;
    Shell._initial = null;
  },

  signedIn() {
    ["mainNav", "topRight", "tabBar"].forEach(id => { document.getElementById(id).hidden = false; });
    document.body.classList.add("signed-in");
    Shell.loadInitial();
  },

  // tab: the route name used for highlighting (feed, mine, collected, tools routes, account)
  setActive(tab, route) {
    Shell.closeAll();
    document.querySelectorAll("[data-nav]").forEach(b =>
      b.classList.toggle("active", b.dataset.nav === tab && !b.classList.contains("uv-chip")));
    const inTools = Shell.TOOL_ROUTES.includes(tab);
    document.querySelectorAll('[data-group="tools"]').forEach(b => b.classList.toggle("active", inTools));
    // Phone: light up "More" when the page lives in the More sheet.
    document.getElementById("moreBtn").classList.toggle("current", inTools || tab === "account");
    // Coming back from Forecast: the saved location may have changed.
    if (Shell._prevRoute === "forecast") Shell._uv = null;
    Shell._prevRoute = route;
    Shell.updateUV();
  },

  async loadInitial() {
    if (Shell._initial) return;
    const btn = document.getElementById("avatarBtn");
    try {
      const { data } = await sb.from("profiles").select("display_name").eq("id", DB.uid()).maybeSingle();
      const name = (data && data.display_name) || "";
      Shell._initial = (name.trim()[0] || "•").toUpperCase();
      btn.textContent = Shell._initial;
      btn.title = name ? name + " · Account" : "Account";
    } catch (e) {
      btn.textContent = "•";
    }
  },

  // UV chip: today's peak UV at the member's saved Forecast location.
  async updateUV() {
    const chip = document.getElementById("uvChip");
    const text = chip.querySelector(".uv-text");
    const paint = (v) => {
      text.innerHTML = v.html;
      chip.dataset.level = v.level || "";
      chip.setAttribute("aria-label", v.label);
    };
    if (Shell._uv && Date.now() - Shell._uv.at < 30 * 60 * 1000) { paint(Shell._uv); return; }
    try {
      const loc = await Forecast.savedLocation();
      if (!loc) {
        Shell._uv = { at: Date.now(), html: "Set your UV location", level: "", label: "Set your UV location in Forecast" };
        paint(Shell._uv);
        return;
      }
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&daily=uv_index_max&timezone=auto&forecast_days=1`);
      const fc = await r.json();
      const uvi = Math.round(fc?.daily?.uv_index_max?.[0] ?? NaN);
      if (!isFinite(uvi)) throw new Error("no uv");
      const b = Forecast.band(uvi);
      Shell._uv = {
        at: Date.now(),
        level: b.label.toLowerCase().replace(/\s+/g, "-"),
        html: `<b>UVI ${uvi}</b><span class="uv-more"> today · ${esc(b.label)}</span><span class="uv-range"> · ${esc(b.range)}</span>`,
        label: `UV index ${uvi} today at ${loc.label}, ${b.label}, exposures about ${b.range}. Open Forecast.`
      };
      paint(Shell._uv);
    } catch (e) {
      paint({ html: "UV forecast", level: "", label: "Open Forecast" });
    }
  }
};
