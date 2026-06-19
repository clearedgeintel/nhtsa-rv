-- 0006_revoke_public_grants.sql — close the view-bypass hole left by Supabase defaults.
--
-- Supabase's default privileges grant anon + authenticated SELECT on new public objects.
-- Our v_* views are SECURITY DEFINER (run as owner → bypass RLS) so the locked-down
-- agent_readonly role can read them. But that same property means anon/authenticated holding
-- SELECT on the views would read ALL data and bypass the RLS added in 0005. Revoke table/view
-- privileges from the public browser roles entirely — this app's browser never touches
-- PostgREST data (it only calls the `ask` Edge Function). agent_readonly keeps its explicit
-- grants on the v_* views; service_role / postgres are unaffected.

revoke all on all tables in schema public from anon, authenticated;
-- Re-assert the only intended reader of the views.
grant select on v_rv_makes, v_recalls, v_recall_vehicles, v_complaints, v_investigations, v_tsbs
  to agent_readonly;
