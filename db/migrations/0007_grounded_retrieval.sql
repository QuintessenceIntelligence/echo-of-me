-- Echo of Me | Migration 0007: provider-free grounded retrieval (slice 3 foundation, ADR-007a).
--
--  * app.search_citable() is the only search entry point. It reads ONLY the citable_source view
--    (approved P1/P2/P3 material), runs as the caller (row-level security applies) and computes the
--    text index on the fly, so an edited, unapproved or deleted item drops out of results immediately
--    (AC-05: the "index window" is zero because there is no separate index to go stale).
--  * Quotes are produced by ts_headline over the approved text, so every quoted fragment is a verbatim
--    substring of something the author approved (RK-01).
--  * rehearsal_turn keeps the author's own rehearsal history (needed for pin/correct/suppress in slice 4).
--    Safety-redirected questions are stored WITHOUT their text.

-- Words that carry no topic in a question ("what would you tell me about ...").
create or replace function app.question_terms(p_question text) returns text[]
language sql immutable set search_path = pg_catalog, pg_temp as $$
  select coalesce(array_agg(distinct t order by t), '{}')
    from unnest(tsvector_to_array(to_tsvector('english', left(coalesce(p_question, ''), 500)))) as t
   where t <> all (array['tell','say','said','think','would','could','should','ever','thing','someth','anyth',
                         'realli','advic','want','know','get','one','like','much','way','us','pleas',
                         'import','mean','matter','view','opinion'])
$$;

create or replace function app.search_citable(p_legacy uuid, p_question text, p_limit int default 8)
returns table (
  source_type text, source_id uuid, memory_id uuid, kind memory_kind, provenance text, title text,
  quote text, full_length int, media_asset_id uuid, sensitivity sensitivity_level, approved_at timestamptz,
  version_no int, matched int, query_terms int, rank real
)
language sql stable security invoker set search_path = public, app, pg_catalog, pg_temp as $$
  with q as (
    select app.question_terms(p_question) as terms
  ), qt as (
    select terms,
           case when cardinality(terms) = 0 then null
                else array_to_string(array(select quote_literal(t) from unnest(terms) t), ' | ')::tsquery end as tsq
      from q
  ), docs as (
    select c.*,
           setweight(to_tsvector('english', coalesce(c.title, '')), 'A') ||
           setweight(to_tsvector('english', coalesce(c.text, '')), 'B') as vec
      from citable_source c
     where c.legacy_id = p_legacy
  ), scored as (
    select d.*, qt.terms, qt.tsq,
           (select count(*)::int from unnest(qt.terms) t where t = any (tsvector_to_array(d.vec))) as m
      from docs d, qt
     where qt.tsq is not null
  )
  select s.source_type, s.source_id, s.memory_id, s.kind, s.provenance, s.title,
         case when s.text is null then null
              when length(s.text) <= 600 then s.text
              else ts_headline('english', s.text, s.tsq,
                     'MaxFragments=2, MaxWords=40, MinWords=12, StartSel="", StopSel="", FragmentDelimiter=" … "')
         end as quote,
         coalesce(length(s.text), 0) as full_length,
         s.media_asset_id, s.sensitivity, s.approved_at, s.version_no,
         s.m as matched, cardinality(s.terms) as query_terms,
         ts_rank_cd(s.vec, s.tsq) as rank
    from scored s
   where s.m > 0
   order by s.m desc, ts_rank_cd(s.vec, s.tsq) desc, s.approved_at desc, s.source_id
   limit greatest(1, least(coalesce(p_limit, 8), 20))
$$;

-- What to offer when nothing matches: the most recently approved items (titles only).
create or replace function app.adjacent_memories(p_legacy uuid, p_limit int default 3)
returns table (memory_id uuid, title text, kind memory_kind)
language sql stable security invoker set search_path = public, app, pg_catalog, pg_temp as $$
  select x.memory_id, x.title, x.kind from (
    select distinct on (c.memory_id) c.memory_id, c.title, c.kind, c.approved_at
      from citable_source c
     where c.legacy_id = p_legacy and c.source_type = 'memory_version' and c.sensitivity = 'standard'
     order by c.memory_id, c.approved_at desc) x
   order by x.approved_at desc, x.memory_id
   limit greatest(1, least(coalesce(p_limit, 3), 10))
$$;

create type answer_kind    as enum ('grounded', 'not_recorded', 'identity', 'safety', 'empty_question');
create type evidence_class as enum ('E1', 'E2', 'E3');

create table rehearsal_turn (
  id             uuid primary key default gen_random_uuid(),
  legacy_id      uuid not null references legacy(id) on delete cascade,
  asked_by       uuid not null references account(id),
  question       text check (question is null or length(question) between 1 and 500),
  kind           answer_kind not null,
  evidence       evidence_class,
  source_ids     uuid[] not null default '{}',
  created_at     timestamptz not null default clock_timestamp(),
  constraint safety_question_not_stored check (kind <> 'safety' or question is null),
  constraint evidence_only_for_answers check ((kind in ('grounded', 'not_recorded')) = (evidence is not null))
);
create index rehearsal_turn_legacy_idx on rehearsal_turn(legacy_id, created_at desc);

create trigger rehearsal_turn_immutable before update on rehearsal_turn for each row execute function app.reject_update();

alter table rehearsal_turn enable row level security;
alter table rehearsal_turn force row level security;
create policy rehearsal_turn_owner_select on rehearsal_turn for select to echo_app using (app.owns_legacy(legacy_id));
create policy rehearsal_turn_owner_insert on rehearsal_turn for insert to echo_app
  with check (app.owns_legacy(legacy_id) and asked_by = app.current_account_id());
create policy rehearsal_turn_owner_delete on rehearsal_turn for delete to echo_app using (app.owns_legacy(legacy_id));
grant select, insert, delete on rehearsal_turn to echo_app;

revoke all on function app.question_terms(text), app.search_citable(uuid, text, int), app.adjacent_memories(uuid, int) from public;
grant execute on function app.question_terms(text), app.search_citable(uuid, text, int), app.adjacent_memories(uuid, int) to echo_app;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on rehearsal_turn from %I', r);
      execute format('revoke all on function app.question_terms(text), app.search_citable(uuid, text, int), app.adjacent_memories(uuid, int) from %I', r);
    end if;
  end loop;
end $$;
