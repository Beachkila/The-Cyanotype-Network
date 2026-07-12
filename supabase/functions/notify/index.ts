// THE CYANOTYPE NETWORK · notify — sends review-result emails immediately.
// Trigger: Database Webhook on INSERT into public.notifications.
// Deploy:  supabase functions deploy notify --no-verify-jwt
// Secrets: RESEND_API_KEY, MAIL_FROM (e.g. "The Cyanotype Network <network@studiowetware.com>"),
//          SITE_URL (e.g. https://network.studiowetware.com)
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const { record: n } = await req.json();
  if (!n || !["approved", "rejected"].includes(n.kind)) {
    return new Response("skip", { status: 200 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const [{ data: prefs }, { data: userRes }] = await Promise.all([
    admin.from("notif_prefs").select("review_emails").eq("user_id", n.user_id).maybeSingle(),
    admin.auth.admin.getUserById(n.user_id)
  ]);
  const email = userRes?.user?.email;
  const wants = prefs?.review_emails !== false; // default on

  if (email && wants) {
    const site = Deno.env.get("SITE_URL") ?? "";
    const title = n.payload?.title ?? "your print";
    const approved = n.kind === "approved";
    const subject = approved
      ? `Your print is live: ${title}`
      : `Your print was returned: ${title}`;
    const body = approved
      ? `<p>Good news — <b>${title}</b> was approved and is now live in the feed.</p>
         <p><a href="${site}/#/print/${n.print_id}">See it in the Network</a></p>`
      : `<p><b>${title}</b> was returned with a note:</p>
         <blockquote>${n.payload?.note ?? ""}</blockquote>
         <p><a href="${site}/#/mine">Edit and resubmit from My Prints</a></p>`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: Deno.env.get("MAIL_FROM"),
        to: email,
        subject,
        html: body + `<p style="color:#66757f;font-size:12px">
          Manage notifications in Account on the Network.</p>`
      })
    });
  }

  await admin.from("notifications").update({ emailed: true }).eq("id", n.id);
  return new Response("ok", { status: 200 });
});
