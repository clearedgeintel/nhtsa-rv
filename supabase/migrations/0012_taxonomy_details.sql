-- 0012_taxonomy_details.sql — "what's behind this number" drill-through for Explore.
-- Clicking a heatmap count lists the underlying complaint records. Returns the public
-- NHTSA complaint fields (ODI number, make/model/year, component, severity, date) plus
-- the sanitized narrative — the same narrative text the `ask` function already returns
-- to the browser via semantic search, over public NHTSA records. Honors the same
-- slicers as the 0011 RPCs. p_severity NULL = all severities for the mode.

create or replace function rpc_failure_mode_details(
  p_mode      text,
  p_severity  text default null,
  p_make      text default null,
  p_my_from   int  default null,
  p_my_to     int  default null,
  p_recv_from int  default null,
  p_recv_to   int  default null,
  p_limit     int  default 25
) returns table (
  odi_id         text,
  make_canonical text,
  model          text,
  model_year     int,
  component      text,
  severity       text,
  date_received  date,
  narrative      text
)
language sql
stable
security definer
set search_path = public
as $$
  select odi_id, make_canonical, model, model_year, component, severity, date_received, narrative
  from complaints
  where failure_mode = p_mode
    and (p_severity  is null or severity = p_severity)
    and (p_make      is null or make_canonical = p_make)
    and (p_my_from   is null or model_year >= p_my_from)
    and (p_my_to     is null or model_year <= p_my_to)
    and (p_recv_from is null or extract(year from date_received) >= p_recv_from)
    and (p_recv_to   is null or extract(year from date_received) <= p_recv_to)
  order by date_received desc nulls last
  limit least(greatest(coalesce(p_limit, 25), 1), 100);
$$;

grant execute on function rpc_failure_mode_details(text, text, text, int, int, int, int, int)
  to anon, authenticated, agent_readonly;

notify pgrst, 'reload schema';
