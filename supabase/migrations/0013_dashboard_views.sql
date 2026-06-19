-- 0013_dashboard_views.sql — aggregate views for the persistent sidebar dashboard.
-- Counts only (no narratives / PII), safe to read with the anon key via PostgREST.
-- Powers: recall-trend sparkline, top defect components, top makes by recalls.

-- Recalls per calendar year (campaigns), for the trend sparkline.
create or replace view v_dash_recall_trend as
  select extract(year from recall_date)::int as year,
         count(*)                            as recalls
  from recalls
  where recall_date is not null
  group by 1
  order by 1;

-- Top defect components by complaint volume.
create or replace view v_dash_top_components as
  select component, count(*) as n
  from complaints
  where component is not null
  group by component
  order by n desc
  limit 12;

-- Top makes by recall campaign count.
create or replace view v_dash_top_makes as
  select make_canonical, count(*) as recalls
  from recalls
  where make_canonical is not null
  group by make_canonical
  order by recalls desc
  limit 12;

grant select on v_dash_recall_trend, v_dash_top_components, v_dash_top_makes
  to anon, authenticated, agent_readonly;
