-- THE CYANOTYPE NETWORK · stage 5 — tag style per print
-- Each print can store the tag layout and color its artist picked ("layout:color",
-- e.g. "museum:navy"). Prints without one show a random style chosen from their id.
-- Safe to run more than once.
alter table public.prints
  add column if not exists tag_style text
  check (tag_style is null or tag_style ~ '^(slab|museum|ledger):(navy|sunfade|paper|tea|bleached|night)$');
