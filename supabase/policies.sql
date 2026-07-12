-- THE CYANOTYPE NETWORK · policies.sql · Stage 1
-- Run after schema.sql. RLS is the security model: the anon key ships in
-- client JS by design, and these policies are what make that safe.

alter table public.profiles      enable row level security;
alter table public.admins        enable row level security;
alter table public.prints        enable row level security;
alter table public.stamps        enable row level security;
alter table public.comments      enable row level security;
alter table public.reports       enable row level security;
alter table public.blocks        enable row level security;
alter table public.notif_prefs   enable row level security;
alter table public.notifications enable row level security;

-- ---------- profiles ----------
create policy "profiles readable by signed-in users"
  on public.profiles for select to authenticated using (true);

create policy "user updates own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- (inserts happen via the signup trigger, which is security definer)

-- ---------- admins ----------
create policy "admins visible to admins"
  on public.admins for select to authenticated using (public.is_admin());
-- no insert/update/delete policies: manage membership from the SQL editor only.

-- ---------- prints ----------
-- Read: approved prints are visible to everyone signed in; owners always see
-- their own; admins see everything (the mod queue).
create policy "read approved or own or admin"
  on public.prints for select to authenticated
  using (status = 'approved' or owner = auth.uid() or public.is_admin());

-- Insert: only as yourself, only as draft or submitted. A user can never
-- create an 'approved' row.
create policy "insert own draft or submission"
  on public.prints for insert to authenticated
  with check (
    owner = auth.uid()
    and status in ('draft','submitted')
  );

-- Update: owners may edit while draft/submitted, and the row must remain
-- draft/submitted — editing can never self-approve, and editing an approved
-- print is not allowed (no approval bypass).
create policy "owner edits pre-review prints"
  on public.prints for update to authenticated
  using (owner = auth.uid() and status in ('draft','submitted'))
  with check (owner = auth.uid() and status in ('draft','submitted'));

-- Approve/reject goes through review_print() (security definer, admin-checked),
-- so no direct admin update policy is required.

create policy "owner deletes own print"
  on public.prints for delete to authenticated
  using (owner = auth.uid());

-- ---------- stamps (stage 4; policies ready now) ----------
create policy "stamps readable" on public.stamps for select to authenticated using (true);
create policy "stamp as yourself, approved prints only"
  on public.stamps for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.prints p where p.id = print_id and p.status = 'approved')
  );
create policy "unstamp your own" on public.stamps for delete to authenticated
  using (user_id = auth.uid());

-- ---------- comments (stage 4) ----------
create policy "comments on approved prints readable"
  on public.comments for select to authenticated
  using (exists (select 1 from public.prints p where p.id = print_id and p.status = 'approved'));
create policy "comment as yourself where allowed"
  on public.comments for insert to authenticated
  with check (
    author = auth.uid()
    and exists (select 1 from public.prints p
                where p.id = print_id and p.status = 'approved' and p.allow_comments)
    and not exists (select 1 from public.blocks b
                where b.blocker = (select owner from public.prints where id = print_id)
                  and b.blocked = auth.uid())
  );
create policy "author or admin deletes comment"
  on public.comments for delete to authenticated
  using (author = auth.uid() or public.is_admin());

-- ---------- reports ----------
create policy "file a report as yourself"
  on public.reports for insert to authenticated with check (reporter = auth.uid());
create policy "admin reads reports"
  on public.reports for select to authenticated using (public.is_admin());
create policy "admin resolves reports"
  on public.reports for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- blocks ----------
create policy "manage your own blocks: read"
  on public.blocks for select to authenticated using (blocker = auth.uid());
create policy "manage your own blocks: add"
  on public.blocks for insert to authenticated with check (blocker = auth.uid());
create policy "manage your own blocks: remove"
  on public.blocks for delete to authenticated using (blocker = auth.uid());

-- ---------- notif prefs / notifications ----------
create policy "own prefs read"  on public.notif_prefs for select to authenticated using (user_id = auth.uid());
create policy "own prefs write" on public.notif_prefs for insert to authenticated with check (user_id = auth.uid());
create policy "own prefs edit"  on public.notif_prefs for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own notifications" on public.notifications for select to authenticated
  using (user_id = auth.uid());

-- ---------- storage: bucket 'prints' ----------
-- Path convention: {owner_uuid}/{random}.jpg
-- Upload: only into your own folder.
create policy "upload into own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'prints' and (storage.foldername(name))[1] = auth.uid()::text);

-- Read: your own files, any admin, or files attached to an approved print.
-- Drafts and pending images are NOT enumerable or fetchable by other users.
create policy "read own, admin, or approved"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'prints' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
      or exists (select 1 from public.prints p
                 where p.image_path = name and p.status = 'approved')
    )
  );

create policy "delete own files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'prints' and (storage.foldername(name))[1] = auth.uid()::text);
