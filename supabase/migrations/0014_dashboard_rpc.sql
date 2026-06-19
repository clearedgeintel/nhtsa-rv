-- 0014_dashboard_rpc.sql — make the sidebar dashboard interactive.
-- One RPC returns the whole dashboard (recall trend + top components + top makes) as JSON,
-- optionally scoped to a single make so clicking a make re-renders the trend + components.
-- Counts only (no narratives / PII); SECURITY DEFINER, matching the 0010/0013 posture.
-- `makes` is always global — it's the picker the user clicks to change focus.

create or replace function rpc_dashboard(p_make text default null)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'trend', coalesce((
      select json_agg(t order by t.year)
      from (
        select extract(year from recall_date)::int as year, count(*) as recalls
        from recalls
        where recall_date is not null
          and (p_make is null or make_canonical = p_make)
        group by 1
      ) t
    ), '[]'::json),
    'components', coalesce((
      select json_agg(c)
      from (
        select component, count(*) as n
        from complaints
        where component is not null
          and (p_make is null or make_canonical = p_make)
        group by component
        order by n desc
        limit 8
      ) c
    ), '[]'::json),
    'makes', coalesce((
      select json_agg(m)
      from (
        select make_canonical, count(*) as recalls
        from recalls
        where make_canonical is not null
        group by make_canonical
        order by recalls desc
        limit 12
      ) m
    ), '[]'::json)
  );
$$;

grant execute on function rpc_dashboard(text) to anon, authenticated, agent_readonly;

notify pgrst, 'reload schema';
