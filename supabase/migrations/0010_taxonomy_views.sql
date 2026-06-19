-- 0010_taxonomy_views.sql — aggregate-only views for the public "Explore" taxonomy browser.
-- These expose COUNTS (no raw narratives / PII), so they're safe to read with the anon key
-- directly via PostgREST. The browser fetches them to render the failure-mode heatmap + drill-down.

create or replace view v_failure_mode_summary as
  select failure_mode,
         count(*)                                  as complaints,
         count(*) filter (where severity = 'critical') as critical,
         count(*) filter (where severity = 'severe')   as severe,
         count(*) filter (where severity = 'moderate') as moderate,
         count(*) filter (where severity = 'minor')    as minor,
         count(distinct make_canonical)            as makes
  from complaints
  where failure_mode is not null
  group by failure_mode;

create or replace view v_failure_mode_component as
  select failure_mode, component, count(*) as n
  from complaints
  where failure_mode is not null and component is not null
  group by failure_mode, component;

create or replace view v_failure_mode_make as
  select failure_mode, make_canonical, count(*) as n
  from complaints
  where failure_mode is not null
  group by failure_mode, make_canonical;

grant select on v_failure_mode_summary, v_failure_mode_component, v_failure_mode_make
  to anon, authenticated, agent_readonly;
