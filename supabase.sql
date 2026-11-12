-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- One row per part. "data" is the whole part as the app stores it.
create table if not exists public.parts (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists parts_updated_at on public.parts (updated_at);

-- The server sets the time, so every device sees changes in the same order.
create or replace function public.parts_touch() returns trigger
language plpgsql as $$ begin new.updated_at = clock_timestamp(); return new; end $$;
drop trigger if exists parts_touch on public.parts;
create trigger parts_touch before insert or update on public.parts
for each row execute function public.parts_touch();

-- No login yet: anyone with the site can read and edit (but not wipe the table).
alter table public.parts enable row level security;
drop policy if exists "read parts" on public.parts;
drop policy if exists "add parts" on public.parts;
drop policy if exists "edit parts" on public.parts;
create policy "read parts" on public.parts for select to anon, authenticated using (true);
create policy "add parts" on public.parts for insert to anon, authenticated with check (true);
create policy "edit parts" on public.parts for update to anon, authenticated using (true) with check (true);
