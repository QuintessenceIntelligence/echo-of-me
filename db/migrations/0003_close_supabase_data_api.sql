-- Echo of Me | Migration 0003: no direct client access to Echo of Me tables (DR-053, DR-057)
--
-- Supabase's default privileges give its public API roles (anon, authenticated) and service_role full
-- rights on every new table in `public`. Echo of Me never lets browsers query the database directly:
-- all access goes through the server, as echo_app, under row-level security. Revoke those rights so
-- the Data API cannot reach these tables even if a policy were ever misconfigured.
-- Safe on plain PostgreSQL: each role is only touched if it exists.
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on all tables in schema public from %I', r);
      execute format('revoke all on all sequences in schema public from %I', r);
      execute format('revoke all on schema app from %I', r);
      execute format('revoke all on all functions in schema app from %I', r);
      -- Future tables and functions created by this owner in these schemas: no automatic grants.
      execute format('alter default privileges in schema public revoke all on tables from %I', r);
      execute format('alter default privileges in schema public revoke all on sequences from %I', r);
      execute format('alter default privileges in schema public revoke all on functions from %I', r);
    end if;
  end loop;
end $$;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Only the application role needs these.
revoke all on all functions in schema app from public;
grant execute on function app.current_account_id(), app.owns_legacy(uuid), app.accept_invitation(text),
                          app.my_recipient_memberships(), app.provision_account(text, text, text) to echo_app;
