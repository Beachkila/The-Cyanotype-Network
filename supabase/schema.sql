-- THE CYANOTYPE NETWORK · schema.sql · Stage 1
-- Run once in Supabase SQL Editor. Creates the full schema (stages 1-7)
-- so later stages ship without migrations.

-- ---------- profiles ----------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 2 and 40),
  created_at    timestamptz not null default now()
);

-- auto-create a profile row on signup, using the display_name passed at signUp()
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''), 'Printer'));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- admins ----------
-- Insert your own auth user id here after your first signup (see SETUP.md).
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------- prints ----------
create type public.print_status as enum ('draft','submitted','approved','rejected');

create table public.prints (
  id             uuid primary key default gen_random_uuid(),
  owner          uuid not null references public.profiles(id) on delete cascade,
  title          text not null check (char_length(title) between 1 and 120),
  image_path     text not null,             -- storage path: {owner}/{uuid}.jpg
  exposure       text,                      -- field report (all optional)
  uvi            text,
  paper          text,
  notes          text check (notes is null or char_length(notes) <= 2000),
  allow_comments boolean not null default true,
  asking_help    boolean not null default false,
  status         public.print_status not null default 'draft',
  review_note    text,                      -- shown to owner on rejection
  submitted_at   timestamptz,
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now()
);

create index prints_feed_idx   on public.prints (status, reviewed_at desc);
create index prints_owner_idx  on public.prints (owner, created_at desc);

-- ---------- stamps (stage 4) ----------
create table public.stamps (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  print_id   uuid not null references public.prints(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, print_id)
);

-- ---------- comments (stage 4) ----------
create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  print_id   uuid not null references public.prints(id) on delete cascade,
  author     uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index comments_print_idx on public.comments (print_id, created_at);

-- ---------- reports (moderation) ----------
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter    uuid not null references public.profiles(id) on delete cascade,
  print_id    uuid references public.prints(id) on delete cascade,
  comment_id  uuid references public.comments(id) on delete cascade,
  reason      text check (reason is null or char_length(reason) <= 500),
  created_at  timestamptz not null default now(),
  resolved    boolean not null default false,
  check (print_id is not null or comment_id is not null)
);

-- ---------- blocks ----------
create table public.blocks (
  blocker    uuid not null references public.profiles(id) on delete cascade,
  blocked    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

-- ---------- notification prefs + queue (stage 6) ----------
create table public.notif_prefs (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  daily_digest   boolean not null default true,
  review_emails  boolean not null default true,
  comment_emails boolean not null default true,
  saved_location text                        -- "Los Angeles, CA|34.05,-118.24" city-level
);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null,                  -- 'approved' | 'rejected' | 'stamp' | 'comment'
  print_id   uuid references public.prints(id) on delete cascade,
  payload    jsonb,
  created_at timestamptz not null default now(),
  emailed    boolean not null default false
);

-- ---------- review helper (admin approve/reject in one call) ----------
create or replace function public.review_print(p_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  update public.prints
     set status = case when p_approve then 'approved'::print_status else 'rejected'::print_status end,
         review_note = p_note,
         reviewed_at = now()
   where id = p_id and status = 'submitted';
  insert into public.notifications (user_id, kind, print_id, payload)
    select owner, case when p_approve then 'approved' else 'rejected' end, id,
           jsonb_build_object('title', title, 'note', p_note)
    from public.prints where id = p_id;
end $$;

-- ---------- storage bucket ----------
insert into storage.buckets (id, name, public)
values ('prints', 'prints', false)
on conflict (id) do nothing;
