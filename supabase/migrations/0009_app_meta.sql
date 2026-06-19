-- 0009_app_meta.sql — small public-readable key/value table for app status (data refresh).
-- The browser reads `data_status` (last ingest time + counts) via PostgREST. Read-only to the
-- public; only ingestion (service_role) writes it.

create table if not exists app_meta (
  key        text primary key,
  value      jsonb,
  updated_at timestamptz not null default now()
);

alter table app_meta enable row level security;

drop policy if exists app_meta_read_public on app_meta;
create policy app_meta_read_public on app_meta
  for select to anon, authenticated
  using (true);

grant select on app_meta to anon, authenticated;
