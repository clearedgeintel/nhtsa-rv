-- 0015_user_data.sql — per-user data behind Supabase Auth.
-- Three owner-scoped tables (chat history, saved RV profiles, saved searches). Each row's
-- user_id defaults to auth.uid() and RLS restricts every operation to the owner, so the
-- anon/authenticated PostgREST roles can only ever touch their own rows. No anon grants.

create extension if not exists pgcrypto;

create table if not exists chat_history (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  question   text not null,
  answer     text not null,
  sources    jsonb,
  sql_used   jsonb,
  grounding  text,
  created_at timestamptz not null default now()
);

create table if not exists rv_profiles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  label      text not null,
  vin        text,
  make       text,
  model      text,
  model_year int,
  created_at timestamptz not null default now()
);

create table if not exists saved_searches (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  label      text not null,
  query      text,                 -- natural-language question (kind = 'question')
  kind       text not null default 'question',
  params     jsonb,                -- explore filters etc. (kind = 'explore')
  created_at timestamptz not null default now()
);

create index if not exists chat_history_user_idx   on chat_history (user_id, created_at desc);
create index if not exists rv_profiles_user_idx    on rv_profiles (user_id, created_at desc);
create index if not exists saved_searches_user_idx on saved_searches (user_id, created_at desc);

alter table chat_history   enable row level security;
alter table rv_profiles    enable row level security;
alter table saved_searches enable row level security;

-- One FOR ALL policy per table: you may only see/insert/update/delete your own rows.
create policy "own rows" on chat_history   for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on rv_profiles    for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on saved_searches for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on chat_history, rv_profiles, saved_searches to authenticated;

notify pgrst, 'reload schema';
