// THE CYANOTYPE NETWORK · admin.js — moderator console: queue + reports (stage 4)
const Admin = {

  async render() {
    const view = document.getElementById("view");
    const { data } = await sb.auth.getSession();
    if (!data.session) {
      view.innerHTML = `<div class="empty">Sign in on the <a href="index.html">main site</a> first, then reload this page.</div>`;
      return;
    }
    DB.session = data.session;
    view.innerHTML = `<div class="empty">Loading…</div>`;

    const [{ data: queue, error: qErr }, { data: reports }] = await Promise.all([
      sb.from("prints")
        .select("*, profiles!prints_owner_fkey(display_name)")
        .eq("status", "submitted")
        .order("submitted_at", { ascending: true }),
      sb.from("reports")
        .select("*, profiles!reports_reporter_fkey(display_name), prints(id, title), comments(id, body, author)")
        .eq("resolved", false)
        .order("created_at", { ascending: true })
    ]);

    if (qErr) { view.innerHTML = `<div class="empty">${esc(qErr.message)}</div>`; return; }
    view.innerHTML = "";

    // ---------- reports ----------
    view.appendChild(el(`<div class="page-head">
      <div><h1>Reports · ${reports?.length || 0}</h1>
      <div class="page-sub">${reports?.length ? "Oldest first" : "Nothing reported"}</div></div></div>`));

    for (const r of (reports || [])) {
      const target = r.comment_id
        ? `Comment: “${esc(r.comments?.body || "(deleted)")}”`
        : `Print: “${esc(r.prints?.title || "(deleted)")}”`;
      const row = el(`
        <article class="row">
          <div class="row-head">
            <b>${target}</b><br>
            <span class="title">Reported by ${esc(r.profiles?.display_name || "Printer")} ·
              ${timeAgo(r.created_at)} ago${r.reason ? ` · “${esc(r.reason)}”` : ""}</span>
          </div>
          <div class="actions">
            ${r.print_id && r.prints ? `<a class="act" href="index.html#/print/${r.prints.id}" target="_blank" rel="noopener">Open print</a>` : ""}
            ${r.comment_id && r.comments ? `<button class="act" data-delc style="color:var(--danger)">Delete comment</button>` : ""}
            <button class="act" data-resolve>Mark resolved</button>
          </div>
        </article>`);
      row.querySelector("[data-delc]")?.addEventListener("click", async (e) => {
        if (!confirm("Delete this comment?")) return;
        e.target.disabled = true;
        const { error } = await sb.from("comments").delete().eq("id", r.comment_id);
        if (error) { alert(error.message); e.target.disabled = false; }
        else Admin.resolve(row, r.id);
      });
      row.querySelector("[data-resolve]").addEventListener("click", () => Admin.resolve(row, r.id));
      view.appendChild(row);
    }

    // ---------- review queue ----------
    view.appendChild(el(`<div class="page-head">
      <div><h1>Waiting for review · ${queue.length}</h1>
      <div class="page-sub">${queue.length ? "Oldest first" : "Queue is clear"}</div></div></div>`));

    if (queue.length) {
      const urls = await DB.signMany(queue.map(p => p.image_path));
      for (const p of queue) {
        const row = el(`
          <article class="row">
            <div class="row-head">
              <b>${esc(p.title)}</b><br>
              <span class="title">by ${esc(p.profiles?.display_name || "Printer")} ·
                submitted ${timeAgo(p.submitted_at)} ago
                ${p.asking_help ? `<span class="tag-help">Asking for help</span>` : ""}</span>
            </div>
            <img class="print" alt="Submitted print: ${esc(p.title)}" src="${urls[p.image_path] || ""}">
            <div class="meta-line">${DB.metaLine(p)}</div>
            ${p.notes ? `<div class="page-sub" style="margin-bottom:8px">Notes: ${esc(p.notes)}</div>` : ""}
            <div class="form" style="padding:0">
              <input type="text" maxlength="500" data-note
                     placeholder="Optional note to the artist (required if returning)">
              <div class="form-foot" style="margin-top:10px">
                <button class="btn" data-approve>Approve — publish to feed</button>
                <button class="btn danger" data-reject>Return with note</button>
              </div>
            </div>
          </article>`);

        const note = row.querySelector("[data-note]");
        row.querySelector("[data-approve]").onclick = () => Admin.review(row, p.id, true, note.value.trim() || null);
        row.querySelector("[data-reject]").onclick = () => {
          if (!note.value.trim()) { note.focus(); note.placeholder = "A note is required when returning a print"; return; }
          Admin.review(row, p.id, false, note.value.trim());
        };
        view.appendChild(row);
      }
    }
  },

  async resolve(row, reportId) {
    const { error } = await sb.from("reports").update({ resolved: true }).eq("id", reportId);
    if (error) alert(error.message);
    else {
      row.style.opacity = ".45";
      row.querySelector(".actions").innerHTML =
        `<div class="msg ok" style="display:block; margin:0">Resolved.</div>`;
    }
  },

  async review(row, id, approve, note) {
    row.querySelectorAll("button").forEach(b => b.disabled = true);
    const { error } = await sb.rpc("review_print", { p_id: id, p_approve: approve, p_note: note });
    if (error) {
      alert(error.message);
      row.querySelectorAll("button").forEach(b => b.disabled = false);
    } else {
      row.style.opacity = ".45";
      row.querySelector(".form").innerHTML =
        `<div class="msg ${approve ? "ok" : "err"}" style="display:block; margin:0">
          ${approve ? "Approved — live in the feed." : "Returned to the artist."}</div>`;
    }
  }
};

window.addEventListener("DOMContentLoaded", () => Admin.render());
