-- Echo of Me | Migration 0002: least-privilege runtime login (ADR-005 amendment, needed for Supabase/hosting)
--
-- The hosted app must never hold owner/superuser credentials. It connects as `echo_app_login`:
--   * NOINHERIT: the login has no table privileges by itself. Only after `SET ROLE echo_app`
--     (done by withActor) do RLS-governed privileges apply. Forgetting SET ROLE = no access.
--   * No password is set here. It is set out of band and stored only in the host's secret store.
-- Account provisioning, previously done with owner credentials, moves into one narrowly scoped
-- SECURITY DEFINER function so the runtime never needs the owner role.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'echo_app_login') then
    create role echo_app_login login noinherit;
  end if;
end $$;
grant echo_app to echo_app_login;

create or replace function app.provision_account(p_auth_subject text, p_email text, p_display_name text)
returns table (status text, account_id uuid)
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_id uuid;
begin
  if p_auth_subject is null or length(p_auth_subject) not between 1 and 255
     or p_email is null or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or p_display_name is null or length(btrim(p_display_name)) not between 1 and 120 then
    return query select 'invalid'::text, null::uuid; return;
  end if;
  select a.id into v_id from account a where a.auth_subject = p_auth_subject;
  if v_id is not null then
    return query select 'existing'::text, v_id; return;
  end if;
  if exists (select 1 from account a where a.email = lower(p_email)) then
    return query select 'email_in_use'::text, null::uuid; return;
  end if;
  insert into account (auth_subject, email, display_name)
  values (p_auth_subject, lower(p_email), btrim(p_display_name)) returning id into v_id;
  insert into audit_event (actor_account_id, action, target_type, target_id)
  values (v_id, 'account.provision', 'account', v_id);
  return query select 'created'::text, v_id;
end $$;

revoke all on function app.provision_account(text, text, text) from public;
grant execute on function app.provision_account(text, text, text) to echo_app;
