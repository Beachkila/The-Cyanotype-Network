-- THE CYANOTYPE NETWORK · stage4.sql
-- Run once in the SQL Editor after stages 1-3 are in.
-- Triggers that queue notifications when a print is stamped or commented on.
-- Stage 6's daily digest reads from public.notifications.

create or replace function public.notify_stamp()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, kind, print_id, payload)
  select p.owner, 'stamp', new.print_id,
         jsonb_build_object('by', (select display_name from public.profiles where id = new.user_id),
                            'title', p.title)
  from public.prints p
  where p.id = new.print_id and p.owner <> new.user_id;
  return new;
end $$;

drop trigger if exists on_stamp_created on public.stamps;
create trigger on_stamp_created
  after insert on public.stamps
  for each row execute function public.notify_stamp();

create or replace function public.notify_comment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, kind, print_id, payload)
  select p.owner, 'comment', new.print_id,
         jsonb_build_object('by', (select display_name from public.profiles where id = new.author),
                            'title', p.title,
                            'snippet', left(new.body, 140))
  from public.prints p
  where p.id = new.print_id and p.owner <> new.author;
  return new;
end $$;

drop trigger if exists on_comment_created on public.comments;
create trigger on_comment_created
  after insert on public.comments
  for each row execute function public.notify_comment();
