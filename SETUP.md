# THE CYANOTYPE NETWORK — Setup (Stages 1–3)

What's built: accounts (email/password), your prints (draft → submit → review → live),
the moderator console, and the public feed. Stamps, comments, Forecast/SUNPRINT,
Collected, and emails arrive in stages 4–6.

## 1 · Create the Supabase project (~5 min)
1. supabase.com → New project. Name: `cyanotype-network`. Region: **West US**.
   Set a strong database password (store it; you rarely need it again).
2. Project **Settings → API**: copy the **Project URL** and the **anon public** key
   into `js/config.js`. (The anon key is meant to be public — the SQL policies are
   the security layer.)

## 2 · Run the SQL (~2 min)
In the Supabase dashboard → **SQL Editor**:
1. Paste and run `supabase/schema.sql`.
2. Paste and run `supabase/policies.sql`.
Both should finish with "Success".

## 3 · Make yourself the moderator (~2 min)
1. Open the site (locally or deployed), **create your own account first** and
   confirm the email.
2. Supabase dashboard → **Authentication → Users** → copy your user's UUID.
3. SQL Editor:
   ```sql
   insert into public.admins (user_id) values ('PASTE-YOUR-UUID-HERE');
   ```
4. `admin.html` now shows you the review queue. Everyone else sees an empty page —
   access is enforced by the database, not the page.

## 4 · Auth email settings (one check)
Authentication → Providers → Email: leave **Confirm email** ON.
Authentication → URL Configuration: set Site URL to your deployed URL
(e.g. `https://network.studiowetware.com`) so confirmation/reset links land correctly.

## 5 · Deploy to GitHub Pages (~5 min)
1. New GitHub repo (public or private — Pages works with either on your plan).
   Push this folder to `main`.
2. Repo **Settings → Pages** → Deploy from branch → `main` / root.
3. Custom domain: `network.studiowetware.com`, then at your DNS add
   `CNAME  network  beachkila.github.io.` Enforce HTTPS once the cert issues.
4. Update the Site URL in step 4 if you deployed before setting the domain.

## 6 · Smoke test (the stage-3 milestone)
1. Second browser/incognito: create a **test account** (any email you control).
2. As the test user: upload a print with a field report → Submit for review.
   It should appear under My Prints as **In review**, and NOT in the feed.
3. As you: open `admin.html` → the print is in the queue → Approve.
4. Test user refreshes: print shows **Live**; it now appears in the feed for
   both accounts, with the field report on its detail page.
5. Also try: Return with a note → test user sees **Returned** with your note,
   edits nothing yet (editing drafts ships in stage 4's polish), resubmits.

## Notes
- Images are resized on the phone before upload (long edge 1600 px, JPEG 85%),
  so free-tier storage (1 GB) is years of runway.
- The `prints` storage bucket is private. Drafts and pending images are only
  visible to their owner and you; feed images are served via signed URLs.
- Local preview: `python3 -m http.server` in this folder → http://localhost:8000
  (opening index.html as a file:// URL won't work — auth needs an http origin,
  and add `http://localhost:8000` to Supabase URL Configuration → Redirect URLs
  while testing).

## Stage 4 — stamps, Collected, comments, report & block
1. SQL Editor: run `supabase/stage4.sql` (notification triggers for stamps
   and comments — the stage-6 digest reads from this queue).
2. Deploy the updated files (git push). No other config changes.

New in the app:
- **Stamps** on feed rows and print pages. One per person, tap again to
  un-stamp. Counts appear only after the first stamp. You can't stamp your
  own print (the button explains why).
- **Collected** tab: everything you've stamped, newest first.
- **Comments** on prints that allow them, posted live, with per-comment
  Report (others') and Delete (your own). Comment counts show on feed rows.
- **Report & block** on print pages. Blocking hides that user's prints and
  comments from you and prevents them commenting on your prints (enforced
  by policy, not just UI). Manage blocked users from Account.
- **Edit & resubmit**: drafts and returned prints now have an Edit button —
  fields prefill, the photo can be replaced, and approved prints remain
  un-editable by design (no approval bypass).
- **Moderator console** now has a Reports section above the queue: open the
  reported print, delete a reported comment, mark resolved.

Smoke test additions:
1. Test user stamps your live print → it appears in their Collected;
   your notifications table gets a 'stamp' row.
2. Test user comments → comment appears on the print; you get a 'comment'
   notification row.
3. Test user reports the comment → it appears in admin.html Reports.
4. Block the test user from one of their prints → their prints vanish from
   your feed; from their account, commenting on YOUR print now fails.

## Stage 5 — Forecast (SUNPRINT)
No SQL, no new services. Deploy and it works:
- First visit to the Forecast tab asks for a location — city search
  (Open-Meteo geocoding) or device location. Saved to your account,
  city-level only; change it from the Forecast header or Account.
- 7-day peak-UVI strip; tap a day for its suggested exposure.
- Today only: **Start a print** runs an adjustable timer (−/+, 1–90 min).
  When it ends (or you tap "Done early"), the upload form opens with UVI
  and exposure time pre-filled. Cancel just stops it.
- Optional: point uv.studiowetware.com at the new Forecast tab with a
  redirect once you're happy with it.

## Stage 6 — Emails + notification settings
App side (already deployed with the files): Account now has three email
toggles (daily digest, review results, comments) and the saved-location row.

Email side (~20 min, one-time):
1. **Resend**: create a free account at resend.com → add and verify the
   domain `studiowetware.com` (two DNS records) → create an API key.
2. **Supabase secrets** — dashboard → Edge Functions → Secrets, add:
   - `RESEND_API_KEY` = your key
   - `MAIL_FROM` = `The Cyanotype Network <network@studiowetware.com>`
   - `SITE_URL` = `https://network.studiowetware.com`
3. **Deploy the functions** (needs the Supabase CLI once, on any machine):
   ```
   supabase functions deploy notify --no-verify-jwt
   supabase functions deploy daily-digest --no-verify-jwt
   ```
4. **Webhook** (instant review emails): dashboard → Database → Webhooks →
   Create: table `public.notifications`, event INSERT, type
   "Supabase Edge Function", function `notify`.
5. **Schedule the digest**: dashboard → Integrations → Cron (pg_cron) →
   new job, e.g. daily at 17:00 UTC (9–10 AM Pacific):
   ```sql
   select cron.schedule('daily-digest', '0 17 * * *', $$
     select net.http_post(
       url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/daily-digest',
       headers := '{"Content-Type":"application/json"}'::jsonb,
       body := '{}'::jsonb
     ) $$);
   ```
Rejection/approval emails respect the "review results" toggle; the digest
respects "daily digest". Every email footers a pointer to Account.

## Stage 7 — PWA
Already wired: manifest, icons, service worker (network-first, so deploys
are never stale; the shell still opens offline). After deploying over HTTPS,
visiting on a phone offers "Add to Home Screen" — full-screen, standalone,
with the blue fern-stamp icon. No app store involved.
