// THE CYANOTYPE NETWORK · daily-digest — one email a day per user with
// new stamps and comments on their prints.
// Trigger: scheduled (cron) — see SETUP.md.
// Deploy:  supabase functions deploy daily-digest --no-verify-jwt
// Secrets: RESEND_API_KEY, MAIL_FROM, SITE_URL
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async () => {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: pending } = await admin
    .from("notifications")
    .select("id, user_id, kind, print_id, payload")
    .eq("emailed", false)
    .in("kind", ["stamp", "comment"])
    .limit(2000);

  if (!pending?.length) return new Response("nothing to send");

  const byUser = new Map<string, typeof pending>();
  for (const n of pending) {
    if (!byUser.has(n.user_id)) byUser.set(n.user_id, []);
    byUser.get(n.user_id)!.push(n);
  }

  const site = Deno.env.get("SITE_URL") ?? "";
  let sent = 0;

  for (const [userId, items] of byUser) {
    const [{ data: prefs }, { data: userRes }] = await Promise.all([
      admin.from("notif_prefs").select("daily_digest, comment_emails").eq("user_id", userId).maybeSingle(),
      admin.auth.admin.getUserById(userId)
    ]);
    const email = userRes?.user?.email;
    const wantsDigest = prefs?.daily_digest !== false;

    if (email && wantsDigest) {
      const stamps = items.filter(i => i.kind === "stamp");
      const comments = items.filter(i => i.kind === "comment");
      const lines: string[] = [];
      if (stamps.length) {
        const titles = [...new Set(stamps.map(s => s.payload?.title))].filter(Boolean);
        lines.push(`<p><b>${stamps.length}</b> new stamp${stamps.length > 1 ? "s" : ""} on:
          ${titles.map(t => `“${t}”`).join(", ")}</p>`);
      }
      for (const c of comments) {
        lines.push(`<p><b>${c.payload?.by ?? "Someone"}</b> commented on “${c.payload?.title}”:
          <i>${c.payload?.snippet ?? ""}</i></p>`);
      }
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: Deno.env.get("MAIL_FROM"),
          to: email,
          subject: "Your prints today on The Cyanotype Network",
          html: lines.join("") +
            `<p><a href="${site}/#/mine">Open My Prints</a></p>
             <p style="color:#66757f;font-size:12px">Manage notifications in Account on the Network.</p>`
        })
      });
      sent++;
    }
    await admin.from("notifications").update({ emailed: true })
      .in("id", items.map(i => i.id));
  }

  return new Response(`digests sent: ${sent}`);
});
