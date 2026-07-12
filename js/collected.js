// THE CYANOTYPE NETWORK · collected.js — prints you've stamped (stage 4)
const Collected = {

  async render(view) {
    view.innerHTML = `<div class="empty">Loading your collection…</div>`;
    const { data, error } = await sb.from("stamps")
      .select("created_at, prints(id, title, image_path, status, owner, profiles!prints_owner_fkey(display_name))")
      .eq("user_id", DB.uid())
      .order("created_at", { ascending: false });

    if (error) { view.innerHTML = `<div class="empty">${esc(error.message)}</div>`; return; }
    const items = (data || []).filter(s => s.prints && s.prints.status === "approved");

    view.innerHTML = "";
    view.appendChild(el(`
      <div class="page-head">
        <div><h1>Collected</h1>
        <div class="page-sub">Prints you've stamped, kept in one place.</div></div>
      </div>`));

    if (!items.length) {
      view.appendChild(el(`<div class="empty">Nothing collected yet.
        Stamp a print in the feed and it lands here.</div>`));
      return;
    }

    const urls = await DB.signMany(items.map(s => s.prints.image_path));
    const grid = el(`<div class="collected-grid"></div>`);
    for (const s of items) {
      const p = s.prints;
      const card = el(`
        <a href="#/print/${p.id}">
          <img class="print" loading="lazy" alt="Collected cyanotype: ${esc(p.title)}"
               src="${urls[p.image_path] || ""}">
          <div class="c-title">${esc(p.title)}</div>
          <div class="c-artist">${esc(p.profiles?.display_name || "Printer")} · stamped ${timeAgo(s.created_at)} ago</div>
        </a>`);
      grid.appendChild(card);
    }
    view.appendChild(grid);
  }
};
