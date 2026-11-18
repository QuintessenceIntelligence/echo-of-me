-- Echo of Me | Migration 0014: personal-data rights for every account (ADR-013).
--  * A recipient can leave a legacy: access ends at once, items shared with them are unshared, and
--    their own questions (and any reports about those answers) are deleted.
--  * Anyone can close their account (after deleting any legacy they author): every membership is left,
--    and the account row is anonymised rather than deleted, because consent records and the activity
--    log must keep pointing at the same opaque id (they hold no names, emails or content).
--  * A closed or unknown account can do nothing: every request sets its actor through app.set_actor,
--    which refuses closed accounts.
-- Functions that mention the new 'left' value are plpgsql, so they are only checked when run
-- (a new enum value cannot be used in the transaction that adds it).

alter type invitation_status add value if not exists 'left';

alter table account add column closed_at timestamptz;
alter table account add constraint closed_account_is_anonymised check (
  closed_at is null
  or (display_name = 'Closed account' and email = 'closed-' || id::text || '@closed.invalid' and auth_subject = 'closed|' || id::text)
);

-- The application changes accounts only through the functions below.
revoke update on account from echo_app;
drop policy if exists account_self_update on account;

-- ---------------------------------------------------------------- actor
create function app.set_actor(p_account uuid) returns void
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  if p_account is null or not exists (select 1 from account where id = p_account and closed_at is null) then
    raise exception 'account_unavailable' using errcode = 'P0001';
  end if;
  perform set_config('app.account_id', p_account::text, true);
end $$;

-- ---------------------------------------------------------------- leave a legacy
-- Returns the recipient record id, or null when the caller is not a joined recipient of that legacy.
create function app.leave_legacy(p_legacy uuid) returns uuid
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_me  uuid := app.current_account_id();
  v_rec uuid;
begin
  if v_me is null then raise exception 'no account'; end if;
  select r.id into v_rec from recipient r
   where r.legacy_id = p_legacy and r.account_id = v_me and r.invitation_status = 'accepted'
   for update;
  if v_rec is null then return null; end if;
  delete from share_grant where recipient_id = v_rec and legacy_id = p_legacy;
  delete from recipient_turn where legacy_id = p_legacy and asked_by = v_me;  -- reports about them cascade
  update recipient set account_id = null, invitation_status = 'left', updated_at = now() where id = v_rec;
  return v_rec;
end $$;

-- ---------------------------------------------------------------- close an account
create function app.close_my_account() returns int
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_me   uuid := app.current_account_id();
  v_left int := 0;
  r      record;
begin
  if v_me is null then raise exception 'no account'; end if;
  if exists (select 1 from legacy where owner_account_id = v_me) then
    raise exception 'owns_legacy' using errcode = 'P0001';
  end if;
  for r in select legacy_id from recipient where account_id = v_me and invitation_status = 'accepted' loop
    perform app.leave_legacy(r.legacy_id);
    v_left := v_left + 1;
  end loop;
  delete from recipient_turn where asked_by = v_me;
  delete from rate_limit where bucket like '%:' || v_me::text;
  update account
     set closed_at = clock_timestamp(),
         display_name = 'Closed account',
         email = 'closed-' || v_me::text || '@closed.invalid',
         auth_subject = 'closed|' || v_me::text
   where id = v_me;
  return v_left;
end $$;

revoke all on function app.set_actor(uuid), app.leave_legacy(uuid), app.close_my_account() from public;
grant execute on function app.set_actor(uuid), app.leave_legacy(uuid), app.close_my_account() to echo_app;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on function app.set_actor(uuid), app.leave_legacy(uuid), app.close_my_account() from %I', r);
    end if;
  end loop;
end $$;
