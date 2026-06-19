-- 0008_feedback.sql — capture thumbs up/down on answers (feeds eval review).
-- Public (anon) may INSERT feedback but cannot read it (no SELECT policy). The browser posts
-- via PostgREST with the anon key.

create table if not exists feedback (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  rating     text not null check (rating in ('up', 'down')),
  question   text,
  answer     text,
  sql_used   jsonb,
  sources    jsonb
);

alter table feedback enable row level security;

-- Insert-only for the public browser roles (revoked-by-default in 0006, re-granted here).
drop policy if exists feedback_insert_public on feedback;
create policy feedback_insert_public on feedback
  for insert to anon, authenticated
  with check (true);

grant insert on feedback to anon, authenticated;
