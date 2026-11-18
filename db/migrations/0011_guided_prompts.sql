-- Echo of Me | Migration 0011: guided prompt library (module 05, ADR-010).
--
-- Editorial prompts only (DR-021: no cross-family mining, no AI). The prompt set is global, non-personal,
-- versioned content; a prompt is never edited in place: it is retired (retired_in) and a new one added.
-- An item can record which prompt it answered. Authors can hide prompts they do not want to see.

create type prompt_theme as enum (
  'values', 'relationships', 'adversity', 'mistakes', 'self_worth', 'family_traditions', 'future_milestones'
);

create table prompt (
  id           text primary key check (id ~ '^[a-z_]+-[0-9]{2}$'),
  set_version  text not null,
  theme        prompt_theme not null,
  position     int not null,
  text         text not null check (length(btrim(text)) between 5 and 300),
  hint         text check (hint is null or length(hint) <= 300),
  gentle       boolean not null default false,   -- emotionally heavy: shown with a "skip any time" note
  retired_in   text,                              -- set version that retired it; null = active
  unique (theme, position, set_version)
);
create trigger prompt_text_immutable before update of text, theme, set_version on prompt
  for each row execute function app.reject_update();

alter table prompt enable row level security;
alter table prompt force row level security;
create policy prompt_read on prompt for select to echo_app using (true);
grant select on prompt to echo_app;

alter table memory_item add column prompt_id text references prompt(id);
create index memory_item_prompt_idx on memory_item(legacy_id, prompt_id) where prompt_id is not null;

create table prompt_dismissal (
  legacy_id     uuid not null references legacy(id) on delete cascade,
  prompt_id     text not null references prompt(id),
  dismissed_at  timestamptz not null default now(),
  primary key (legacy_id, prompt_id)
);
alter table prompt_dismissal enable row level security;
alter table prompt_dismissal force row level security;
create policy prompt_dismissal_owner_all on prompt_dismissal for all to echo_app
  using (app.owns_legacy(legacy_id)) with check (app.owns_legacy(legacy_id));
grant select, insert, delete on prompt_dismissal to echo_app;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on prompt, prompt_dismissal from %I', r);
    end if;
  end loop;
end $$;
