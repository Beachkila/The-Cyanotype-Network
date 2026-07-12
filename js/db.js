// THE CYANOTYPE NETWORK · db.js — client init + shared helpers
const sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const DB = {
  session: null,

  async init() {
    const { data } = await sb.auth.getSession();
    DB.session = data.session;
    sb.auth.onAuthStateChange((_evt, session) => {
      DB.session = session;
      Router.onAuthChange();
    });
  },

  uid() { return DB.session?.user?.id || null; },

  // Signed URLs for the private bucket. RLS on storage decides what each
  // user may sign: own files, admin, or approved-print files.
  async signUrl(path) {
    if (!path) return "";
    const { data, error } = await sb.storage.from(CONFIG.BUCKET)
      .createSignedUrl(path, CONFIG.SIGNED_URL_TTL);
    return error ? "" : data.signedUrl;
  },

  async signMany(paths) {
    const uniq = [...new Set(paths.filter(Boolean))];
    if (!uniq.length) return {};
    const { data, error } = await sb.storage.from(CONFIG.BUCKET)
      .createSignedUrls(uniq, CONFIG.SIGNED_URL_TTL);
    const map = {};
    if (!error && data) data.forEach(d => { if (d.signedUrl) map[d.path] = d.signedUrl; });
    return map;
  },

  metaLine(p) {
    return [p.uvi && `UVI ${esc(p.uvi)}`, p.exposure && esc(p.exposure), p.paper && esc(p.paper)]
      .filter(Boolean).join(" · ") || "No field report given";
  }
};

// tiny helpers
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g,
    c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
function timeAgo(iso) {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return Math.max(1, Math.floor(s / 60)) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  if (s < 7 * 86400) return Math.floor(s / 86400) + "d";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
