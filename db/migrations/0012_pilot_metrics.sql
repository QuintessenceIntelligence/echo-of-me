-- Echo of Me | Migration 0012: pilot measures without new data collection (slice 6, ADR-011).
--
-- Computes the pilot hypothesis measures (01D §5) from data that already exists, as AGGREGATES ONLY:
-- no legacy ids, names, questions or content leave the function. It can be executed only by the
-- NOLOGIN role echo_metrics (an operator must be granted it explicitly), never by the application role.
-- Use with real pilot participants requires the pilot research consent and approval (founder / legal ⚖).

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'echo_metrics') then
    create role echo_metrics nologin;
  end if;
end $$;

create function app.pilot_metrics(p_since timestamptz default null)
returns table (metric text, value numeric, denominator int, note text)
language sql stable security definer set search_path = public, app, pg_temp as $$
  with l as (
    select id, created_at from legacy where p_since is null or created_at >= p_since
  ), approved as (
    -- H1: legacies with >= 5 approved items whose approval happened within 21 days of creation
    select l.id, count(i.id) filter (where i.approval = 'approved' and i.approved_at <= l.created_at + interval '21 days') as n
      from l left join memory_item i on i.legacy_id = l.id group by l.id
  ), capture_days as (
    select a.legacy_id, date_trunc('day', a.occurred_at) as d
      from audit_event a join l on l.id = a.legacy_id
     where a.outcome = 'success' and a.action in ('memory.create', 'memory.edit', 'media.add', 'transcript.save')
     group by 1, 2
  ), returns as (
    -- H2: a second capture day within 14 days of the first
    select legacy_id, (array_agg(d order by d))[2] - min(d) <= interval '14 days' as returned
      from capture_days group by legacy_id
  ), turns as (
    select t.kind, t.evidence from rehearsal_turn t join l on l.id = t.legacy_id
  ), rturns as (
    select t.kind, t.evidence from recipient_turn t join l on l.id = t.legacy_id
  )
  select 'legacies', count(*)::numeric, null::int, 'legacies created in the period' from l
  union all
  select 'h1_five_approved_within_21_days_pct',
         round(100.0 * count(*) filter (where n >= 5) / nullif(count(*), 0), 1), count(*)::int, 'H1 target >= 60 %' from approved
  union all
  select 'h2_second_capture_day_within_14_days_pct',
         round(100.0 * count(*) filter (where returned) / nullif((select count(*) from l), 0), 1), (select count(*) from l)::int, 'H2 target >= 50 %' from returns
  union all
  select 'practice_answers_not_recorded_pct',
         round(100.0 * count(*) filter (where evidence = 'E3') / nullif(count(*) filter (where evidence is not null), 0), 1),
         count(*) filter (where evidence is not null)::int, 'share of author practice answers that were E3' from turns
  union all
  select 'recipient_answers_not_recorded_pct',
         round(100.0 * count(*) filter (where evidence = 'E3') / nullif(count(*) filter (where evidence is not null), 0), 1),
         count(*) filter (where evidence is not null)::int, 'share of recipient answers that were E3' from rturns
  union all
  select 'safety_routings', (select count(*) from turns where kind = 'safety') + (select count(*) from rturns where kind = 'safety'), null,
         'questions routed to help lines (author + recipient); review each as a potential H8 incident'
  union all
  select 'answer_reports_' || r.reason::text, count(*)::numeric, null, 'reports by reason'
    from answer_report r join l on l.id = r.legacy_id group by r.reason
$$;

revoke all on function app.pilot_metrics(timestamptz) from public;
grant usage on schema app to echo_metrics;
grant execute on function app.pilot_metrics(timestamptz) to echo_metrics;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on function app.pilot_metrics(timestamptz) from %I', r);
    end if;
  end loop;
end $$;
