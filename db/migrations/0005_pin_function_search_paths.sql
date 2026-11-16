-- Echo of Me | Migration 0005: pin search_path on helper functions (Supabase security advisor 0011).
-- Prevents a function from resolving names through a schema someone else controls.
alter function app.current_account_id()   set search_path = pg_catalog, pg_temp;
alter function app.owns_legacy(uuid)      set search_path = public, app, pg_catalog, pg_temp;
alter function app.reject_mutation()      set search_path = pg_catalog, pg_temp;
alter function app.hash_consent_body()    set search_path = pg_catalog, pg_temp;
alter function app.touch_updated_at()     set search_path = pg_catalog, pg_temp;
