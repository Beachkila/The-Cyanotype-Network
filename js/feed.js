// THE CYANOTYPE NETWORK · feed.js — feed, print detail, stamps, comments,
// report & block (stage 4)
const Feed = {

  _blocked: null,
  async blockedSet(force) {
    if (Feed._blocked && !force) return Feed._blocked;
    const { data } = await sb.from("blocks").select("blocked").eq("blocker", DB.uid());
    Feed._blocked = new Set((data || []).map(b => b.blocked));
    return Feed._blocked;
  },

  stampSVG() {
    return `<svg class="mark" viewBox="0 0 26 30" aria-hidden="true">
      <rect class="stamp-frame stamp-fill" x="2" y="2" width="22" height="26" rx="2"/>
      <path class="stamp-fern" d="M13 24 Q13 14 13 7 M13 18 Q9 16 8 12 M13 18 Q17 16 18 12 M13 12 Q10 10 10 8 M13 12 Q16 10 16 8"/>
    </svg>`;
  },

  stampButton(p, mine) {
    const on = p._stamped;
    const n = p._stampCount;
    return `<button class="act stamp-btn ${on ? "stamped" : ""}" data-stamp="${p.id}"
      ${mine ? 'disabled title="You can\u2019t stamp your own print"' : ""}
      aria-pressed="${on}" aria-label="${on ? "Remove your stamp" : "Stamp this print"}">
      ${Feed.stampSVG()}
      <span class="stamp-word">${on ? "Stamped" : "Stamp"}</span>
      <span class="count">${n > 0 ? n : ""}</span>
    </button>`;
  },

  wireStamp(root) {
    root.querySelectorAll("[data-stamp]").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (btn.disabled) return;
        btn.disabled = true;
        const id = btn.dataset.stamp;
        const on = btn.classList.contains("stamped");
        const { error } = on
          ? await sb.from("stamps").delete().match({ user_id: DB.uid(), print_id: id })
          : await sb.from("stamps").insert({ user_id: DB.uid(), print_id: id });
        if (!error) {
          const countEl = btn.querySelector(".count");
          let n = parseInt(countEl.textContent || "0", 10) + (on ? -1 : 1);
          btn.classList.toggle("stamped", !on);
          btn.setAttribute("aria-pressed", String(!on));
          btn.querySelector(".stamp-word").textContent = on ? "Stamp" : "Stamped";
          countEl.textContent = n > 0 ? n : "";
        }
        btn.disabled = false;
      });
    });
  },

  async render(view) {
    view.innerHTML = `<div class="empty">Loading the feed…</div>`;
    const [{ data: prints, error }, blocked, { data: myStamps }] = await Promise.all([
      sb.from("prints")
        .select("id, title, image_path, uvi, exposure, paper, asking_help, reviewed_at, owner, allow_comments, profiles(display_name), stamps(count), comments(count)")
        .eq("status", "approved")
        .order("reviewed_at", { ascending: false })
        .limit(50),
      Feed.blockedSet(true),
      sb.from("stamps").select("print_id").eq("user_id", DB.uid())
    ]);

    if (error) { view.innerHTML = `<div class="empty">Couldn't load the feed. ${esc(error.message)}</div>`; return; }
    const mineStamped = new Set((myStamps || []).map(s => s.print_id));
    const visible = prints.filter(p => !blocked.has(p.owner));
    if (!visible.length) {
      view.innerHTML = `<div class="empty">No prints yet. Yours could be the first —
        head to <b>My Prints</b> and upload one.</div>`;
      return;
    }

    const urls = await DB.signMany(visible.map(p => p.image_path));
    view.innerHTML = "";
    for (const p of visible) {
      p._stamped = mineStamped.has(p.id);
      p._stampCount = p.stamps?.[0]?.count || 0;
      const nComments = p.comments?.[0]?.count || 0;
      const row = el(`
        <article class="row clickable" tabindex="0" role="link" aria-label="Open ${esc(p.title)}">
          <div class="row-head">
            <b>${esc(p.profiles?.display_name || "Printer")}</b>
            <span class="time">· ${timeAgo(p.reviewed_at)}</span><br>
            <span class="title">${esc(p.title)}</span>
            ${p.asking_help ? `<span class="tag-help">Asking for help</span>` : ""}
          </div>
          <img class="print" loading="lazy" alt="Cyanotype print: ${esc(p.title)}"
               src="${urls[p.image_path] || ""}">
          <div class="meta-line">${DB.metaLine(p)}</div>
          <div class="actions">
            ${Feed.stampButton(p, p.owner === DB.uid())}
            ${p.allow_comments ? `<button class="act" data-open>Comments${nComments ? " · " + nComments : ""}</button>` : ""}
          </div>
        </article>`);
      const open = () => Router.go("print/" + p.id);
      row.onclick = open;
      row.onkeydown = e => { if (e.key === "Enter" && e.target === row) open(); };
      row.querySelector("[data-open]")?.addEventListener("click", e => { e.stopPropagation(); open(); });
      view.appendChild(row);
    }
    Feed.wireStamp(view);
  },

  async detail(view, id) {
    view.innerHTML = `<div class="empty">Loading print…</div>`;
    const [{ data: p, error }, blocked, { data: myStamp }] = await Promise.all([
      sb.from("prints").select("*, profiles(display_name), stamps(count)").eq("id", id).single(),
      Feed.blockedSet(),
      sb.from("stamps").select("print_id").match({ user_id: DB.uid(), print_id: id })
    ]);
    if (error || !p) { view.innerHTML = `<div class="empty">Print not found.</div>`; return; }

    p._stamped = (myStamp || []).length > 0;
    p._stampCount = p.stamps?.[0]?.count || 0;
    const mine = p.owner === DB.uid();
    const url = await DB.signUrl(p.image_path);

    view.innerHTML = "";
    view.appendChild(el(`
      <div>
        <div class="page-head">
          <button class="back" id="backBtn">← Back</button>
          ${p.asking_help ? `<span class="tag-help">Asking for help</span>` : ""}
        </div>
        <div class="detail-body">
          <img class="print" alt="Cyanotype print: ${esc(p.title)}" src="${url}">
          <h2>${esc(p.title)}</h2>
          <div class="byline">
            <span>${esc(p.profiles?.display_name || "Printer")} · Posted ${new Date(p.reviewed_at || p.created_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</span>
            ${mine ? "" : `<span class="byline-tools">
              <button class="act" data-report-print>Report</button>
              <button class="act" data-block>Block</button></span>`}
          </div>
          <div class="actions">${Feed.stampButton(p, mine)}</div>
          <table class="report">
            <caption>FIELD REPORT</caption>
            ${p.exposure ? `<tr><td>Exposure</td><td>${esc(p.exposure)}</td></tr>` : ""}
            ${p.uvi ? `<tr><td>UV index</td><td>${esc(p.uvi)}</td></tr>` : ""}
            ${p.paper ? `<tr><td>Paper</td><td>${esc(p.paper)}</td></tr>` : ""}
            ${p.notes ? `<tr><td>Notes</td><td>${esc(p.notes)}</td></tr>` : ""}
            ${!p.exposure && !p.uvi && !p.paper && !p.notes
              ? `<tr><td>Field report</td><td>None given</td></tr>` : ""}
          </table>
          <div class="comments" id="comments"></div>
        </div>
      </div>`));

    view.querySelector("#backBtn").onclick = () => history.length > 1 ? history.back() : Router.go("feed");
    Feed.wireStamp(view);

    view.querySelector("[data-report-print]")?.addEventListener("click",
      () => Feed.report({ print_id: p.id }));
    view.querySelector("[data-block]")?.addEventListener("click", async () => {
      const name = p.profiles?.display_name || "this artist";
      if (!confirm(`Block ${name}? You won't see their prints or comments, and they can't comment on yours. You can unblock from Account.`)) return;
      const { error } = await sb.from("blocks").insert({ blocker: DB.uid(), blocked: p.owner });
      if (error && !error.message.includes("duplicate")) return alert(error.message);
      await Feed.blockedSet(true);
      Router.go("feed");
    });

    if (p.allow_comments && p.status === "approved") {
      Feed.comments(view.querySelector("#comments"), p, blocked);
    } else if (!p.allow_comments) {
      view.querySelector("#comments").innerHTML =
        `<div class="form-note">The artist has turned comments off for this print.</div>`;
    }
  },

  async comments(box, p, blocked) {
    const { data: list, error } = await sb.from("comments")
      .select("id, body, created_at, author, profiles(display_name)")
      .eq("print_id", p.id)
      .order("created_at", { ascending: true });
    if (error) { box.innerHTML = `<div class="form-note">${esc(error.message)}</div>`; return; }

    const visible = (list || []).filter(c => !blocked.has(c.author));
    box.innerHTML = `<h3>Comments${visible.length ? " · " + visible.length : ""}</h3>`;

    for (const c of visible) {
      const own = c.author === DB.uid();
      const row = el(`
        <div class="comment">
          <b>${esc(c.profiles?.display_name || "Printer")}</b>
          <span class="time">· ${timeAgo(c.created_at)}</span>
          <span class="comment-tools">
            ${own
              ? `<button class="act" data-del>Delete</button>`
              : `<button class="act" data-rep>Report</button>`}
          </span><br>${esc(c.body)}
        </div>`);
      row.querySelector("[data-rep]")?.addEventListener("click",
        () => Feed.report({ comment_id: c.id }));
      row.querySelector("[data-del]")?.addEventListener("click", async () => {
        if (!confirm("Delete your comment?")) return;
        const { error } = await sb.from("comments").delete().eq("id", c.id);
        if (error) alert(error.message); else Feed.comments(box, p, blocked);
      });
      box.appendChild(row);
    }

    const form = el(`
      <div class="comment-box">
        <input type="text" maxlength="1000" placeholder="Add a comment" aria-label="Add a comment">
        <button class="btn" type="button">Post</button>
      </div>`);
    const input = form.querySelector("input"), btn = form.querySelector("button");
    const post = async () => {
      const body = input.value.trim();
      if (!body) return;
      btn.disabled = true;
      const { error } = await sb.from("comments")
        .insert({ print_id: p.id, author: DB.uid(), body });
      btn.disabled = false;
      if (error) {
        alert(error.message.includes("row-level security")
          ? "Your comment couldn't be posted on this print."
          : error.message);
      } else { input.value = ""; Feed.comments(box, p, blocked); }
    };
    btn.onclick = post;
    input.onkeydown = e => { if (e.key === "Enter") post(); };
    box.appendChild(form);
  },

  async report(target) {
    const reason = prompt("Why are you reporting this? (optional)");
    if (reason === null) return;
    const { error } = await sb.from("reports")
      .insert({ reporter: DB.uid(), reason: reason.trim() || null, ...target });
    alert(error ? error.message : "Reported. The moderator will take a look — thank you.");
  }
};
