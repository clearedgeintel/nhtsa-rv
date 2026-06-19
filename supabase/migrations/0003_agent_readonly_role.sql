-- 0003_agent_readonly_role.sql — the read-only "cage" for the agent's SQL tool (CLAUDE.md §7)
--
-- This role is the ONLY DB principal the `ask` Edge Function uses for execute_sql.
-- It can SELECT the v_* views and nothing else: no base tables, no INSERT/UPDATE/DELETE,
-- no DDL, no auth/storage. Even a prompt-injected query physically cannot write.

-- Create the login role. The password below is a PLACEHOLDER only; the real password is
-- set out-of-band (ALTER ROLE agent_readonly PASSWORD '...') and carried in AGENT_DB_URL.
-- It is never committed to the repo.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'agent_readonly') then
    create role agent_readonly with login password 'CHANGE_ME_set_out_of_band';
  end if;
end
$$;

-- Lock the role down to read-only intent at the role level (defense in depth).
alter role agent_readonly set statement_timeout = '5000';        -- 5s cap (§7.4)
alter role agent_readonly set default_transaction_read_only = on;
alter role agent_readonly set search_path = public;

-- Schema access: usage only (needed to reference objects), no create.
grant usage on schema public to agent_readonly;
revoke create on schema public from agent_readonly;

-- The ONLY object privileges the role gets: SELECT on the read-only views.
grant select on
  v_rv_makes,
  v_recalls,
  v_complaints,
  v_investigations,
  v_tsbs
to agent_readonly;

-- Belt-and-suspenders: ensure the role holds nothing on base tables or sequences.
revoke all on rv_makes, recalls, complaints, investigations, tsbs from agent_readonly;
revoke all on all sequences in schema public from agent_readonly;
