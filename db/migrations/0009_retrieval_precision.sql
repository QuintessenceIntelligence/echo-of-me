-- Echo of Me | Migration 0009: retrieval precision (evaluation finding E-01, ADR-007a v1.1).
--
-- The v1.0 evaluation showed that one shared everyday word in the BODY of an unrelated memory
-- ("move", "choose") produced a "related" (E2) answer to out-of-corpus questions. search_citable now
-- also reports how many question topic words appear in the item's TITLE, so the classifier can require
-- either two shared topic words or a title match before calling anything related.
-- The function's result type changes, so it is dropped and recreated (same name, same grants).

drop function app.search_citable(uuid, text, int);

create function app.search_citable(p_legacy uuid, p_question text, p_limit int default 8)
returns table (
  source_type text, source_id uuid, memory_id uuid, kind memory_kind, provenance text, title text,
  quote text, full_length int, media_asset_id uuid, sensitivity sensitivity_level, approved_at timestamptz,
  version_no int, matched int, title_matched int, query_terms int, rank real
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
           (select count(*)::int from unnest(qt.terms) t where t = any (tsvector_to_array(d.vec))) as m,
           (select count(*)::int from unnest(qt.terms) t
             where t = any (tsvector_to_array(to_tsvector('english', coalesce(d.title, ''))))) as tm
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
         s.m as matched, s.tm as title_matched, cardinality(s.terms) as query_terms,
         ts_rank_cd(s.vec, s.tsq) as rank
    from scored s
   where s.m > 0
   order by s.m desc, ts_rank_cd(s.vec, s.tsq) desc, s.approved_at desc, s.source_id
   limit greatest(1, least(coalesce(p_limit, 8), 20))
$$;

revoke all on function app.search_citable(uuid, text, int) from public;
grant execute on function app.search_citable(uuid, text, int) to echo_app;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on function app.search_citable(uuid, text, int) from %I', r);
    end if;
  end loop;
end $$;

-- Indefinite pronouns carry no topic ("how do I forgive someone?") — evaluation finding E-03.
create or replace function app.question_terms(p_question text) returns text[]
language sql immutable set search_path = pg_catalog, pg_temp as $$
  select coalesce(array_agg(distinct t order by t), '{}')
    from unnest(tsvector_to_array(to_tsvector('english', left(coalesce(p_question, ''), 500)))) as t
   where t <> all (array['tell','say','said','think','would','could','should','ever','thing','someth','anyth',
                         'realli','advic','want','know','get','one','like','much','way','us','pleas',
                         'import','mean','matter','view','opinion',
                         'someon','anyon','everyon','somebodi','anybodi','everybodi','everyth','noth','nobodi'])
$$;
