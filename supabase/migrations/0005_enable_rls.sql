-- 0005_enable_rls.sql — lock base tables against the public anon/authenticated roles.
--
-- The anon (publishable) key ships to the browser; without RLS, anyone with it could read
-- or write these tables directly via PostgREST. This app never touches base tables from the
-- browser (it only calls the `ask` Edge Function), so we enable RLS with NO policies:
--   • anon / authenticated (PostgREST)  → blocked (no policy = deny)
--   • postgres (owns the v_* views)     → bypasses RLS → views keep working for agent_readonly
--   • service_role (ingestion)          → bypasses RLS → loads keep working
-- Not FORCED, so the table owner is exempt and view access is unaffected.

alter table rv_makes        enable row level security;
alter table recalls         enable row level security;
alter table recall_vehicles enable row level security;
alter table complaints      enable row level security;
alter table investigations  enable row level security;
alter table tsbs            enable row level security;
