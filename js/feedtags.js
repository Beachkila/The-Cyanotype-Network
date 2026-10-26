// THE CYANOTYPE NETWORK · feedtags.js — each print's tag in the feed and the upload style picker
// A print's style is saved as "layout:color" in prints.tag_style. Prints without one get a
// style picked from their id, so older posts show a random mix that stays the same every visit.
const FeedTags = {
  LAYOUTS: [["slab", "Slab"], ["museum", "Museum label"], ["ledger", "Ledger band"]],
  COLORS: {"navy": {"name": "Network navy", "frame": "#16385c", "face": "#fbf9f5", "ink": "#16385c", "soft": "#7f8f9e", "line": "#e6e2d8", "tabBg": "#16385c", "tabInk": "#fbf9f5", "band": "#0e2a47", "bandInk": "#fbf9f5", "dot": "#16385c"}, "sunfade": {"name": "Sun-fade", "frame": "#7a9cbd", "face": "#fbf9f5", "ink": "#2c4a6a", "soft": "#7f8f9e", "line": "#e6e2d8", "tabBg": "#2c4a6a", "tabInk": "#fbf9f5", "band": "#6a8cad", "bandInk": "#ffffff", "dot": "#7a9cbd"}, "paper": {"name": "Paper", "frame": "#e9e1cf", "face": "#fdfbf6", "ink": "#16385c", "soft": "#8a8f94", "line": "#e3dccb", "tabBg": "#16385c", "tabInk": "#fdfbf6", "band": "#16385c", "bandInk": "#fdfbf6", "dot": "#e9e1cf"}, "tea": {"name": "Tea-toned", "frame": "#7a5a3f", "face": "#f7f0e4", "ink": "#4a3626", "soft": "#8c7660", "line": "#e6d9c6", "tabBg": "#7a5a3f", "tabInk": "#f7f0e4", "band": "#67492f", "bandInk": "#f7f0e4", "dot": "#7a5a3f"}, "bleached": {"name": "Bleached", "frame": "#a9b8c4", "face": "#fbfbf9", "ink": "#3e5466", "soft": "#8796a3", "line": "#e3e7ea", "tabBg": "#3e5466", "tabInk": "#fbfbf9", "band": "#c9d4dc", "bandInk": "#1f3344", "dot": "#a9b8c4"}, "night": {"name": "Night", "frame": "#121a24", "face": "#f4f2ec", "ink": "#121a24", "soft": "#6d747c", "line": "#dedad0", "tabBg": "#121a24", "tabInk": "#f4f2ec", "band": "#1e2935", "bandInk": "#f4f2ec", "dot": "#121a24"}},
  BRAND: { top: "THE CYANOTYPE", bottom: "NETWORK" },
  SCALE: 0.2,          // 1120 x 320 px: sharp at feed size, light on memory
  _fonts: null,

  fonts() {
    if (!FeedTags._fonts) FeedTags._fonts = TagEngine.loadFonts();
    return FeedTags._fonts;
  },

  hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  },

  // -> { layout, color }
  styleFor(p) {
    const keys = Object.keys(FeedTags.COLORS);
    const layouts = FeedTags.LAYOUTS.map(l => l[0]);
    const [l, c] = String(p.tag_style || "").split(":");
    if (layouts.includes(l) && keys.includes(c)) return { layout: l, color: c };
    const h = FeedTags.hash(String(p.id || p.title || "tcn"));
    return { layout: layouts[h % layouts.length], color: keys[Math.floor(h / 7) % keys.length] };
  },

  dataFor(p, artist) {
    const clip = (s, n) => { s = String(s || "").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
    const when = p.reviewed_at || p.created_at;
    return {
      title: clip(p.title, 40),
      artist: clip(artist, 30),
      medium: clip(p.paper ? "Cyanotype on " + p.paper : "Cyanotype", 40),
      size: "", edition: "",
      year: when ? String(new Date(when).getFullYear()) : String(new Date().getFullYear()),
      qr: ""
    };
  },

  async draw(canvas, p, artist, style) {
    await FeedTags.fonts();
    const s = style || FeedTags.styleFor(p);
    TagEngine.renderFront(canvas, FeedTags.dataFor(p, artist), FeedTags.COLORS[s.color], s.layout, FeedTags.BRAND, FeedTags.SCALE);
  },

  // Upload form: layout chips, color swatches and a live preview.
  // getPrint() returns the current form values; returns { value() } -> "layout:color"
  picker(root, current, getPrint, artist) {
    const start = FeedTags.styleFor({ tag_style: current, id: "new-" + Date.now() });
    const layouts = FeedTags.LAYOUTS.map(([k, n]) =>
      `<label class="tag-choice"><input type="radio" name="tagLayout" value="${k}"${k === start.layout ? " checked" : ""}><span>${n}</span></label>`).join("");
    const colors = Object.entries(FeedTags.COLORS).map(([k, c]) =>
      `<label class="tag-choice swatch" style="--dot:${c.dot}"><input type="radio" name="tagColor" value="${k}"${k === start.color ? " checked" : ""}><span>${esc(c.name)}</span></label>`).join("");
    root.innerHTML = `
      <canvas class="tag-preview" width="1120" height="320" aria-label="Preview of this print's tag" role="img"></canvas>
      <div class="tag-choices" role="radiogroup" aria-label="Tag layout">${layouts}</div>
      <div class="tag-choices" role="radiogroup" aria-label="Tag color">${colors}</div>`;
    const canvas = root.querySelector("canvas");
    const value = () => {
      const l = root.querySelector('input[name="tagLayout"]:checked')?.value || start.layout;
      const c = root.querySelector('input[name="tagColor"]:checked')?.value || start.color;
      return l + ":" + c;
    };
    const redraw = () => FeedTags.draw(canvas, getPrint(), artist(), FeedTags.styleFor({ tag_style: value() }));
    root.querySelectorAll("input").forEach(i => i.addEventListener("change", redraw));
    redraw();
    return { value, redraw };
  },

  // tag_style may not exist in the database yet; these let the app keep working until it does.
  missingColumn(error) {
    return !!error && /tag_style/i.test(error.message || "");
  },

  // true once supabase/stage5_tag_style.sql has been run (checked once per visit)
  _hasColumn: null,
  async columnReady() {
    if (FeedTags._hasColumn !== null) return FeedTags._hasColumn;
    try {
      const { error } = await sb.from("prints").select("tag_style").limit(1);
      FeedTags._hasColumn = !error;
    } catch (e) {
      FeedTags._hasColumn = false;
    }
    return FeedTags._hasColumn;
  }
};
