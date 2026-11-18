-- Echo of Me | Migration 0008: author rehearsal controls (slice 4, AC-11, ADR-008).
--
-- The author can teach Echo of Me how a question should be answered, without any AI:
--   pin       this approved item IS the answer to questions with these topic words (served as E1)
--   suppress  never use this item for questions with these topic words
-- "Answer it yourself" creates a new approved item in the author's own words and pins it.
--
-- A rule is keyed by the question's topic words (app.question_terms, sorted and distinct), so it
-- also applies to the same question asked with the same topic words in a different order or phrasing.
-- Rules point at an item, never at text: a pinned item is only served while it is approved, and the
-- quoted words always come from citable_source. Deleting the item deletes its rules.

create type answer_rule_action as enum ('pin', 'suppress');

create table answer_rule (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   uuid not null references legacy(id) on delete cascade,
  memory_id   uuid not null,
  question    text not null check (length(btrim(question)) between 1 and 500),
  terms       text[] not null check (cardinality(terms) between 1 and 60),
  action      answer_rule_action not null,
  created_by  uuid not null references account(id),
  created_at  timestamptz not null default clock_timestamp(),
  foreign key (memory_id, legacy_id) references memory_item(id, legacy_id) on delete cascade
);
-- One pinned answer per question; a given item is pinned or suppressed for a question at most once.
create unique index answer_rule_one_pin on answer_rule(legacy_id, terms) where action = 'pin';
create unique index answer_rule_unique on answer_rule(legacy_id, terms, memory_id);
create index answer_rule_memory_idx on answer_rule(memory_id);

create trigger answer_rule_immutable before update on answer_rule for each row execute function app.reject_update();

alter table answer_rule enable row level security;
alter table answer_rule force row level security;
create policy answer_rule_owner_select on answer_rule for select to echo_app using (app.owns_legacy(legacy_id));
create policy answer_rule_owner_insert on answer_rule for insert to echo_app
  with check (app.owns_legacy(legacy_id) and created_by = app.current_account_id());
create policy answer_rule_owner_delete on answer_rule for delete to echo_app using (app.owns_legacy(legacy_id));
grant select, insert, delete on answer_rule to echo_app;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on answer_rule from %I', r);
    end if;
  end loop;
end $$;
