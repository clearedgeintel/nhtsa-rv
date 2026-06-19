-- 0002_views.sql — read-only views the agent's SQL role may SELECT (CLAUDE.md §4, §7)
--
-- IMPORTANT (the cage): these are DEFAULT Postgres views (security_invoker is OFF).
-- A default view accesses its base tables with the VIEW OWNER's privileges (postgres),
-- not the caller's. So agent_readonly needs SELECT on these views ONLY and never on the
-- base tables. Do NOT add `with (security_invoker = true)` — that would require the role
-- to hold base-table privileges and break the isolation.

create or replace view v_rv_makes as
  select make_canonical, make_variants, category, is_motorhome_chassis
  from rv_makes;

create or replace view v_recalls as
  select campaign_id, make_canonical, model, model_year, component,
         recall_date, affected_units, summary, consequence, remedy, is_chassis
  from recalls;

-- Note: the raw `embedding` vector is intentionally excluded — the agent queries meaning
-- via the search_narratives tool, not by SELECTing 1024-dim vectors as JSON.
create or replace view v_complaints as
  select odi_id, make_canonical, model, model_year, component,
         date_received, narrative, failure_mode, severity
  from complaints;

create or replace view v_investigations as
  select odi_action_no, make_canonical, component,
         open_date, close_date, subject, summary
  from investigations;

create or replace view v_tsbs as
  select tsb_id, make_canonical, model, model_year, component, summary
  from tsbs;
