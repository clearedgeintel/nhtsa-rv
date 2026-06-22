-- 0016_public_data_views.sql — expose the gold views for the public raw-data browser.
-- These are the same read-only v_* views the SQL agent uses (default views, so they read
-- their base tables with the owner's rights and the `embedding` vector is excluded). The
-- underlying NHTSA records are public data, so granting anon SELECT lets the frontend page
-- through them via PostgREST (limit/offset, order, ilike, Accept: text/csv) with no server
-- code. This does NOT touch the agent_readonly cage or the base tables.

grant select on v_recalls, v_complaints, v_investigations, v_tsbs, v_rv_makes
  to anon, authenticated;

notify pgrst, 'reload schema';
