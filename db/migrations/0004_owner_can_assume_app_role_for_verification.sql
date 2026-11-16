-- Echo of Me | Migration 0004: let the database owner run isolation checks as echo_app (SET ROLE).
-- INHERIT FALSE: the owner gains no privileges from this. No-op where the owner is a superuser.
do $$ begin
  execute format('grant echo_app to %I with inherit false, set true', current_user);
exception when others then null;
end $$;
