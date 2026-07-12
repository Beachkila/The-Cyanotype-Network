// THE CYANOTYPE NETWORK · myprints.js — your prints, upload/edit, account (stage 4)
const Mine = {

  STATUS: {
    draft:     { cls: "draft",    label: "Draft",     sub: "Only you can see this" },
    submitted: { cls: "review",   label: "In review", sub: "You'll be notified when it's reviewed" },
    approved:  { cls: "live",     label: "Live",      sub: "Visible in the feed" },
    rejected:  { cls: "rejected", label: "Returned",  sub: "" }
  },

  async render(view) {
    view.innerHTML = `<div class="empty">Loading your prints…</div>`;
    const { data: prints, error } = await sb
      .from("prints").select("*")
      .eq("owner", DB.uid())
      .order("created_at", { ascending: false });

    if (error) { view.innerHTML = `<div class="empty">${esc(error.message)}</div>`; return; }
    const urls = await DB.signMany((prints || []).map(p => p.image_path));

    view.innerHTML = "";
    view.appendChild(el(`
      <div class="page-head">
        <div><h1>My Prints</h1><div class="page-sub">Drafts stay private until you submit them.</div></div>
        <button class="btn" id="uploadBtn">Upload a print</button>
      </div>`));
    view.querySelector("#uploadBtn").onclick = () => Router.go("upload");

    if (!prints.length) {
      view.appendChild(el(`<div class="empty">Nothing here yet — upload your first print.</div>`));
      return;
    }

    for (const p of prints) {
      const s = Mine.STATUS[p.status];
      const sub = p.status === "rejected" && p.review_note
        ? `Returned with a note: “${esc(p.review_note)}” — edit and resubmit`
        : s.sub;
      const editable = p.status === "draft" || p.status === "rejected";
      const row = el(`
        <article class="row">
          <div class="row-head">
            <b>${esc(p.title)}</b> <span class="status ${s.cls}">${s.label}</span><br>
            <span class="title">${sub}</span>
          </div>
          <img class="print" loading="lazy" alt="Your print: ${esc(p.title)}"
               src="${urls[p.image_path] || ""}">
          <div class="actions">
            ${p.status === "approved" ? `<button class="act" data-act="view">View in feed</button>` : ""}
            ${editable ? `<button class="act" data-act="edit">Edit</button>
                          <button class="act" data-act="submit">Submit for review</button>` : ""}
            <button class="act" data-act="delete" style="color:var(--danger)">Delete</button>
          </div>
        </article>`);

      row.querySelector('[data-act="view"]')?.addEventListener("click",
        () => Router.go("print/" + p.id));
      row.querySelector('[data-act="edit"]')?.addEventListener("click",
        () => Router.go("edit/" + p.id));
      row.querySelector('[data-act="submit"]')?.addEventListener("click", async (e) => {
        e.target.disabled = true;
        const { error } = await sb.from("prints")
          .update({ status: "submitted", submitted_at: new Date().toISOString(), review_note: null })
          .eq("id", p.id);
        if (error) { alert(error.message); e.target.disabled = false; }
        else Mine.render(view);
      });
      row.querySelector('[data-act="delete"]')?.addEventListener("click", async () => {
        if (!confirm(`Delete “${p.title}”? This can't be undone.`)) return;
        await sb.storage.from(CONFIG.BUCKET).remove([p.image_path]);
        const { error } = await sb.from("prints").delete().eq("id", p.id);
        if (error) alert(error.message); else Mine.render(view);
      });
      view.appendChild(row);
    }
  },

  // shared form for upload (no existing print) and edit (existing draft/returned)
  async uploadForm(view, editId) {
    let existing = null;
    if (editId) {
      const { data } = await sb.from("prints").select("*").eq("id", editId).single();
      if (!data || data.owner !== DB.uid() || !["draft", "rejected"].includes(data.status)) {
        view.innerHTML = `<div class="empty">This print can't be edited.</div>`;
        return;
      }
      existing = data;
    }
    let prefill = null;
    if (!existing) {
      try { prefill = JSON.parse(sessionStorage.getItem("tcn_prefill") || "null"); } catch {}
      sessionStorage.removeItem("tcn_prefill");
    }
    const v = existing || prefill || {};
    view.innerHTML = "";
    view.appendChild(el(`
      <div>
        <div class="page-head"><button class="back" id="backBtn">← My Prints</button></div>
        <div class="msg" id="upMsg"></div>
        <form class="form" id="upForm">
          <h1>${existing ? "Edit print" : "Upload a print"}</h1>
          ${(!existing && v.uvi) ? `<div class="form-note">Field report started from your exposure timer — UVI and time are filled in.</div>` : ""}
          <label for="u-img">Image ${existing ? `<span class="opt">(leave empty to keep the current photo)</span>` : ""}</label>
          <input id="u-img" type="file" accept="image/*" ${existing ? "" : "required"}>
          <label for="u-title">Title</label>
          <input id="u-title" type="text" maxlength="120" required value="${esc(v.title || "")}"
                 placeholder="What do you call this print?">
          <label for="u-exp">Exposure time <span class="opt">(optional)</span></label>
          <input id="u-exp" type="text" maxlength="80" value="${esc(v.exposure || "")}" placeholder="e.g. 12 minutes, direct sun">
          <label for="u-uvi">UV index <span class="opt">(optional)</span></label>
          <input id="u-uvi" type="text" maxlength="20" value="${esc(v.uvi || "")}" placeholder="e.g. 8">
          <label for="u-paper">Paper or surface <span class="opt">(optional)</span></label>
          <input id="u-paper" type="text" maxlength="120" value="${esc(v.paper || "")}" placeholder="e.g. Canson XL watercolor">
          <label for="u-notes">Notes <span class="opt">(optional)</span></label>
          <textarea id="u-notes" maxlength="2000" placeholder="Formula, toning, what worked, what didn't">${esc(v.notes || "")}</textarea>
          <label class="check"><input id="u-comments" type="checkbox" ${v.allow_comments === false ? "" : "checked"}> Allow comments</label>
          <label class="check"><input id="u-help" type="checkbox" ${v.asking_help ? "checked" : ""}> I'm asking for help with this print</label>
          <div class="form-foot">
            <button class="btn" type="submit">Submit for review</button>
            <button class="btn secondary" type="button" id="draftBtn">Save as draft</button>
            <span class="form-note">Submitted prints are reviewed before they appear in the feed.</span>
          </div>
        </form>
      </div>`));

    view.querySelector("#backBtn").onclick = () => Router.go("mine");
    const form = view.querySelector("#upForm");
    const save = async (status) => {
      const msg = view.querySelector("#upMsg");
      const btns = form.querySelectorAll("button");
      btns.forEach(b => b.disabled = true);
      msg.className = "msg ok"; msg.textContent = "Saving…";
      try {
        const file = view.querySelector("#u-img").files[0];
        let image_path = existing?.image_path || null;
        if (file) {
          msg.textContent = "Uploading image…";
          const newPath = await Upload.send(file);
          if (existing?.image_path) await sb.storage.from(CONFIG.BUCKET).remove([existing.image_path]);
          image_path = newPath;
        }
        if (!image_path) throw new Error("Choose an image first.");
        const fields = {
          title: view.querySelector("#u-title").value.trim(),
          image_path,
          exposure: view.querySelector("#u-exp").value.trim() || null,
          uvi: view.querySelector("#u-uvi").value.trim() || null,
          paper: view.querySelector("#u-paper").value.trim() || null,
          notes: view.querySelector("#u-notes").value.trim() || null,
          allow_comments: view.querySelector("#u-comments").checked,
          asking_help: view.querySelector("#u-help").checked,
          status,
          review_note: null,
          submitted_at: status === "submitted" ? new Date().toISOString() : null
        };
        const { error } = existing
          ? await sb.from("prints").update(fields).eq("id", existing.id)
          : await sb.from("prints").insert({ owner: DB.uid(), ...fields });
        if (error) throw error;
        Router.go("mine");
      } catch (err) {
        msg.className = "msg err"; msg.textContent = err.message;
        btns.forEach(b => b.disabled = false);
      }
    };
    form.onsubmit = (e) => { e.preventDefault(); save("submitted"); };
    view.querySelector("#draftBtn").onclick = () => {
      if (form.reportValidity()) save("draft");
    };
  },

  async account(view) {
    const email = DB.session?.user?.email || "";
    const [{ data: prof }, { data: blocks }, { data: prefs }] = await Promise.all([
      sb.from("profiles").select("display_name").eq("id", DB.uid()).single(),
      sb.from("blocks").select("blocked, profiles!blocks_blocked_fkey(display_name)").eq("blocker", DB.uid()),
      sb.from("notif_prefs").select("*").eq("user_id", DB.uid()).maybeSingle()
    ]);
    view.innerHTML = "";
    view.appendChild(el(`
      <div>
        <div class="page-head">
          <div><h1>Account</h1><div class="page-sub">Signed in as ${esc(email)}</div></div>
        </div>
        <div class="form">
          <label for="dn">Display name</label>
          <input id="dn" type="text" maxlength="40" value="${esc(prof?.display_name || "")}">
          <div class="form-foot">
            <button class="btn" id="saveName">Save name</button>
            <button class="btn secondary" id="signOut">Sign out</button>
          </div>
          <div class="msg" id="accMsg"></div>
        </div>
        <div class="page-head"><div><h1 style="font-size:16px">Notifications</h1>
        <div class="page-sub">Emails from the Network. Turn any of them off here.</div></div></div>
        <div id="prefRows"></div>
        <div class="page-head"><div><h1 style="font-size:16px">Blocked users</h1></div></div>
        <div id="blockList"></div>
      </div>`));

    const p = prefs || { daily_digest: true, review_emails: true, comment_emails: true, saved_location: null };
    const prefRows = view.querySelector("#prefRows");
    const PREFS = [
      ["daily_digest",   "Daily digest",              "One email a day with new stamps on your prints"],
      ["review_emails",  "Print approved or returned", "Email when a review finishes"],
      ["comment_emails", "New comments on my prints",  "Email when someone replies"]
    ];
    for (const [key, lab, sub] of PREFS) {
      const row = el(`
        <div class="set-row">
          <div><div class="lab">${lab}</div><div class="page-sub">${sub}</div></div>
          <label class="switch"><input type="checkbox" ${p[key] ? "checked" : ""}>
          <span class="track"></span></label>
        </div>`);
      row.querySelector("input").onchange = async (e) => {
        const { error } = await sb.from("notif_prefs")
          .upsert({ user_id: DB.uid(), [key]: e.target.checked });
        if (error) { alert(error.message); e.target.checked = !e.target.checked; }
      };
      prefRows.appendChild(row);
    }
    const locLabel = (p.saved_location || "").split("|")[0] || "Not set";
    const locRow = el(`
      <div class="set-row">
        <div><div class="lab">Saved location</div>
        <div class="page-sub">${esc(locLabel)} · used for your UV forecast (city-level only)</div></div>
        <button class="btn secondary">Change</button>
      </div>`);
    locRow.querySelector("button").onclick = () => { Router.go("forecast"); Forecast.picker(Router.view); };
    prefRows.appendChild(locRow);

    const list = view.querySelector("#blockList");
    if (!blocks?.length) {
      list.innerHTML = `<div class="empty" style="padding:20px">You haven't blocked anyone.</div>`;
    } else {
      for (const b of blocks) {
        const row = el(`
          <div class="set-row">
            <div class="lab">${esc(b.profiles?.display_name || "Printer")}</div>
            <button class="btn secondary">Unblock</button>
          </div>`);
        row.querySelector("button").onclick = async (e) => {
          e.target.disabled = true;
          await sb.from("blocks").delete().match({ blocker: DB.uid(), blocked: b.blocked });
          Feed._blocked = null;
          Mine.account(view);
        };
        list.appendChild(row);
      }
    }

    view.querySelector("#saveName").onclick = async () => {
      const display_name = view.querySelector("#dn").value.trim();
      const m = view.querySelector("#accMsg");
      const { error } = await sb.from("profiles")
        .update({ display_name }).eq("id", DB.uid());
      m.className = "msg " + (error ? "err" : "ok");
      m.textContent = error ? error.message : "Saved.";
    };
    view.querySelector("#signOut").onclick = () => Auth.signOut();
  }
};
