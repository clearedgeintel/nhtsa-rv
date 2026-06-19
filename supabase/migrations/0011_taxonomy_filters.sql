-- 0011_taxonomy_filters.sql — slicers for the "Explore" taxonomy browser.
-- Adds parameterized RPCs so the heatmap + drill-down can be filtered by brand
-- (make_canonical), model year, and NHTSA-received (created) year. Like the 0010
-- views, these return COUNTS ONLY (no raw narratives / PII), so they're safe to
-- expose to the anon key. All params are NULL-tolerant: NULL = "no filter / All".
-- SECURITY DEFINER (owned by postgres) lets them read `complaints` past RLS while
-- exposing only aggregates, matching the 0010 posture.

-- Filtered failure-mode summary (heatmap rows).
create or replace function rpc_failure_mode_summary(
  p_make      text default null,
  p_my_from   int  default null,
  p_my_to     int  default null,
  p_recv_from int  default null,
  p_recv_to   int  default null
) returns table (
  failure_mode text,
  complaints   bigint,
  critical     bigint,
  severe       bigint,
  moderate     bigint,
  minor        bigint,
  makes        bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select failure_mode,
         count(*)                                       as complaints,
         count(*) filter (where severity = 'critical')  as critical,
         count(*) filter (where severity = 'severe')    as severe,
         count(*) filter (where severity = 'moderate')  as moderate,
         count(*) filter (where severity = 'minor')     as minor,
         count(distinct make_canonical)                 as makes
  from complaints
  where failure_mode is not null
    and (p_make      is null or make_canonical = p_make)
    and (p_my_from   is null or model_year >= p_my_from)
    and (p_my_to     is null or model_year <= p_my_to)
    and (p_recv_from is null or extract(year from date_received) >= p_recv_from)
    and (p_recv_to   is null or extract(year from date_received) <= p_recv_to)
  group by failure_mode;
$$;

-- Top components for one failure mode, under the same filters (drill-down).
create or replace function rpc_failure_mode_component(
  p_mode      text,
  p_make      text default null,
  p_my_from   int  default null,
  p_my_to     int  default null,
  p_recv_from int  default null,
  p_recv_to   int  default null
) returns table (component text, n bigint)
language sql
stable
security definer
set search_path = public
as $$
  select component, count(*) as n
  from complaints
  where failure_mode = p_mode
    and component is not null
    and (p_make      is null or make_canonical = p_make)
    and (p_my_from   is null or model_year >= p_my_from)
    and (p_my_to     is null or model_year <= p_my_to)
    and (p_recv_from is null or extract(year from date_received) >= p_recv_from)
    and (p_recv_to   is null or extract(year from date_received) <= p_recv_to)
  group by component
  order by n desc
  limit 8;
$$;

-- Top makes for one failure mode, under the same filters (drill-down).
create or replace function rpc_failure_mode_make(
  p_mode      text,
  p_make      text default null,
  p_my_from   int  default null,
  p_my_to     int  default null,
  p_recv_from int  default null,
  p_recv_to   int  default null
) returns table (make_canonical text, n bigint)
language sql
stable
security definer
set search_path = public
as $$
  select make_canonical, count(*) as n
  from complaints
  where failure_mode = p_mode
    and (p_make      is null or make_canonical = p_make)
    and (p_my_from   is null or model_year >= p_my_from)
    and (p_my_to     is null or model_year <= p_my_to)
    and (p_recv_from is null or extract(year from date_received) >= p_recv_from)
    and (p_recv_to   is null or extract(year from date_received) <= p_recv_to)
  group by make_canonical
  order by n desc
  limit 8;
$$;

-- Option sources for the slicers.
-- Brands that actually appear in classified complaints (most-common first).
create or replace view v_explore_makes as
  select make_canonical, count(*) as n
  from complaints
  where failure_mode is not null and make_canonical is not null
  group by make_canonical;

-- Year bounds for the model-year and received-year range selects.
create or replace view v_explore_bounds as
  select min(model_year)                         as my_min,
         max(model_year)                         as my_max,
         min(extract(year from date_received))::int as recv_min,
         max(extract(year from date_received))::int as recv_max
  from complaints
  where failure_mode is not null;

grant select on v_explore_makes, v_explore_bounds to anon, authenticated, agent_readonly;
grant execute on function
  rpc_failure_mode_summary(text, int, int, int, int),
  rpc_failure_mode_component(text, text, int, int, int, int),
  rpc_failure_mode_make(text, text, int, int, int, int)
  to anon, authenticated, agent_readonly;

notify pgrst, 'reload schema';
