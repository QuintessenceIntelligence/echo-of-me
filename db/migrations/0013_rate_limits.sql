-- Echo of Me | Migration 0013: per-account rate limits (hardening, ADR-012).
-- Fixed-window counters kept in the database, so limits hold across serverless instances.
-- Attempts are counted in their own committed transaction, before the action runs, so a failing or
-- refused attempt still uses up allowance (scripted abuse cannot avoid the limit by sending bad input).
-- The application role cannot read or write the table; it can only call app.rate_limit_hit, which
-- counts against the signed-in account's own buckets and returns the hits in the current window.

create table rate_limit (
  bucket        text primary key,
  window_start  timestamptz not null,
  hits          int not null check (hits >= 0)
);
alter table rate_limit enable row level security;
alter table rate_limit force row level security;  -- no policies: only the function below touches it

create function app.rate_limit_hit(p_action text, p_window_seconds int) returns int
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_me     uuid := app.current_account_id();
  v_now    timestamptz := clock_timestamp();
  v_bucket text;
  v_hits   int;
begin
  if v_me is null then raise exception 'no account'; end if;
  if p_action !~ '^[a-z_]{1,40}$' or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate limit request';
  end if;
  v_bucket := p_action || ':' || v_me::text;
  insert into rate_limit as r (bucket, window_start, hits) values (v_bucket, v_now, 1)
  on conflict (bucket) do update set
    window_start = case when r.window_start <= v_now - make_interval(secs => p_window_seconds) then v_now else r.window_start end,
    hits         = case when r.window_start <= v_now - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end
  returning hits into v_hits;
  return v_hits;
end $$;

revoke all on function app.rate_limit_hit(text, int) from public;
grant execute on function app.rate_limit_hit(text, int) to echo_app;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on rate_limit from %I', r);
      execute format('revoke all on function app.rate_limit_hit(text, int) from %I', r);
    end if;
  end loop;
end $$;
