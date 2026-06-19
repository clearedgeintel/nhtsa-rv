-- 0007_grant_agent_role_to_postgres.sql — let the Edge Function drop into the cage.
--
-- The `ask` function connects via the auto-injected SUPABASE_DB_URL (as `postgres`) and, for
-- every model-generated query, runs it inside a READ ONLY transaction under
-- `SET LOCAL ROLE agent_readonly`. For that SET ROLE to be permitted, postgres must be a
-- member of agent_readonly. This grants no new ability to postgres (already privileged); it
-- only enables stepping DOWN into the restricted role. Write-prevention is enforced by three
-- independent layers: the read-only transaction, the agent_readonly privileges (SELECT on
-- v_* views only), and the SQL guard in the function.

grant agent_readonly to postgres;
