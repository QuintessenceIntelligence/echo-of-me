-- Echo of Me | Migration 0010: sharing with adult recipients and recipient questions (slice 5, ADR-009).
--
-- Rules (MVP: living author, author-initiated sharing, adults only — DR-026, DR-032):
--  * The author shares an item with a named recipient (share_grant). Nothing else grants access.
--  * Access is re-checked on every read, inside the database (app.shared_with_me): the grant exists,
--    the recipient accepted and is an adult, the legacy is active, the item is approved, sensitive items
--    were explicitly confirmed, and the author's "share with recipients" consent is currently given.
--    Any of these changing removes access immediately; re-approving an item restores it.
--  * Recipients get read-only row-level access to the CURRENT APPROVED version of shared items, their
--    original media and approved transcripts. Never drafts, earlier versions, tags, audience or rules.
--    citable_source and app.search_citable therefore work unchanged for recipients.
--  * Recipient questions are private to the recipient (recipient_turn). The author's activity log gets
--    the fact, evidence class and source ids only. A recipient may choose to report an answer.

create table share_grant (
  memory_id            uuid not null,
  recipient_id         uuid not null,
  legacy_id            uuid not null,
  granted_by           uuid not null references account(id),
  granted_at           timestamptz not null default clock_timestamp(),
  sensitive_confirmed  boolean not null default false,
  primary key (memory_id, recipient_id),
  foreign key (memory_id, legacy_id) references memory_item(id, legacy_id) on delete cascade,
  foreign key (recipient_id, legacy_id) references recipient(id, legacy_id) on delete cascade
);
create index share_grant_recipient_idx on share_grant(recipient_id);
create trigger share_grant_immutable before update on share_grant for each row execute function app.reject_update();

alter table share_grant enable row level security;
alter table share_grant force row level security;
create policy share_grant_owner_select on share_grant for select to echo_app using (app.owns_legacy(legacy_id));
create policy share_grant_owner_insert on share_grant for insert to echo_app
  with check (app.owns_legacy(legacy_id) and granted_by = app.current_account_id());
create policy share_grant_owner_delete on share_grant for delete to echo_app using (app.owns_legacy(legacy_id));
grant select, insert, delete on share_grant to echo_app;

-- ---------------------------------------------------------------- effective-access checks
-- SECURITY DEFINER so they can read grants, recipients, items and the author's consent across RLS.
-- Each answers one yes/no question about the CALLER (app.current_account_id()) and returns nothing else.

create function app.author_has_consent(p_legacy uuid, p_purpose consent_purpose) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce((
    select c.action = 'granted'
      from legacy l
      join current_consent c on c.account_id = l.owner_account_id and c.legacy_id is null and c.purpose = p_purpose
     where l.id = p_legacy), false)
$$;

create function app.is_member(p_legacy uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select exists (
    select 1 from recipient r join legacy l on l.id = r.legacy_id
     where r.legacy_id = p_legacy
       and r.account_id = app.current_account_id()
       and r.invitation_status = 'accepted'
       and not r.is_minor
       and l.state = 'active')
$$;

create function app.shared_with_me(p_memory uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select exists (
    select 1
      from share_grant g
      join recipient r   on r.id = g.recipient_id and r.legacy_id = g.legacy_id
      join legacy l      on l.id = g.legacy_id
      join memory_item i on i.id = g.memory_id and i.legacy_id = g.legacy_id
     where g.memory_id = p_memory
       and r.account_id = app.current_account_id()
       and r.invitation_status = 'accepted'
       and not r.is_minor
       and l.state = 'active'
       and i.approval = 'approved'
       and (i.sensitivity = 'standard' or g.sensitive_confirmed)
       and app.author_has_consent(l.id, 'share_with_recipients'))
$$;

create function app.shared_version(p_memory uuid, p_version int) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select app.shared_with_me(p_memory)
     and exists (select 1 from memory_item i where i.id = p_memory and i.current_version = p_version)
$$;

create function app.shared_media(p_asset uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce((select app.shared_with_me(m.memory_id) from media_asset m where m.id = p_asset), false)
$$;

create function app.shared_transcript_version(p_asset uuid, p_version int) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select app.shared_media(p_asset)
     and exists (select 1 from transcript t
                  where t.media_asset_id = p_asset and t.approval = 'approved' and t.current_version = p_version)
$$;

-- Author answer rules (pins / suppressions) for a question, readable by the author and by members.
-- Pins only take effect if the pinned item is visible to the caller (read through citable_source).
create function app.answer_rules_for(p_legacy uuid, p_terms text[])
returns table (id uuid, memory_id uuid, action answer_rule_action, created_at timestamptz)
language sql stable security definer set search_path = public, app, pg_temp as $$
  select r.id, r.memory_id, r.action, r.created_at
    from answer_rule r
   where r.legacy_id = p_legacy and r.terms = p_terms
     and (app.owns_legacy(p_legacy) or app.is_member(p_legacy))
$$;

-- ---------------------------------------------------------------- recipient read policies
create policy memory_item_recipient_select on memory_item for select to echo_app
  using (app.shared_with_me(id));
create policy memory_version_recipient_select on memory_version for select to echo_app
  using (app.shared_version(memory_id, version_no));
create policy media_asset_recipient_select on media_asset for select to echo_app
  using (app.shared_media(id));
create policy transcript_recipient_select on transcript for select to echo_app
  using (approval = 'approved' and app.shared_media(media_asset_id));
create policy transcript_version_recipient_select on transcript_version for select to echo_app
  using (app.shared_transcript_version(media_asset_id, version_no));

-- ---------------------------------------------------------------- recipient questions and reports
create table recipient_turn (
  id           uuid primary key default gen_random_uuid(),
  legacy_id    uuid not null references legacy(id) on delete cascade,
  asked_by     uuid not null references account(id),
  question     text check (question is null or length(question) between 1 and 500),
  kind         answer_kind not null,
  evidence     evidence_class,
  source_ids   uuid[] not null default '{}',
  created_at   timestamptz not null default clock_timestamp(),
  constraint recipient_safety_question_not_stored check (kind <> 'safety' or question is null),
  constraint recipient_evidence_only_for_answers check ((kind in ('grounded', 'not_recorded')) = (evidence is not null))
);
create index recipient_turn_asker_idx on recipient_turn(asked_by, legacy_id, created_at desc);
create trigger recipient_turn_immutable before update on recipient_turn for each row execute function app.reject_update();

alter table recipient_turn enable row level security;
alter table recipient_turn force row level security;
-- Private to the person who asked: the author cannot read recipients' questions.
create policy recipient_turn_self_select on recipient_turn for select to echo_app using (asked_by = app.current_account_id());
create policy recipient_turn_self_insert on recipient_turn for insert to echo_app
  with check (asked_by = app.current_account_id() and app.is_member(legacy_id));
create policy recipient_turn_self_delete on recipient_turn for delete to echo_app using (asked_by = app.current_account_id());
grant select, insert, delete on recipient_turn to echo_app;

create type report_reason as enum ('not_what_they_meant', 'upsetting', 'wrong_or_outdated', 'other');

create table answer_report (
  id            uuid primary key default gen_random_uuid(),
  legacy_id     uuid not null references legacy(id) on delete cascade,
  turn_id       uuid not null references recipient_turn(id) on delete cascade,
  reported_by   uuid not null references account(id),
  reason        report_reason not null,
  note          text check (note is null or length(note) between 1 and 500),
  question      text check (question is null or length(question) between 1 and 500),  -- only if the recipient chose to include it
  source_ids    uuid[] not null default '{}',
  evidence      evidence_class,
  created_at    timestamptz not null default clock_timestamp(),
  resolved_at   timestamptz,
  unique (turn_id)
);
create index answer_report_legacy_idx on answer_report(legacy_id, created_at desc);

alter table answer_report enable row level security;
alter table answer_report force row level security;
create policy answer_report_reporter_select on answer_report for select to echo_app using (reported_by = app.current_account_id());
create policy answer_report_reporter_insert on answer_report for insert to echo_app
  with check (reported_by = app.current_account_id() and app.is_member(legacy_id));
create policy answer_report_owner_select on answer_report for select to echo_app using (app.owns_legacy(legacy_id));
-- The author can mark a report resolved (and nothing else; enforced by the column grant below).
create policy answer_report_owner_update on answer_report for update to echo_app
  using (app.owns_legacy(legacy_id)) with check (app.owns_legacy(legacy_id));
grant select, insert on answer_report to echo_app;
grant update (resolved_at) on answer_report to echo_app;

-- ---------------------------------------------------------------- privileges
revoke all on function app.author_has_consent(uuid, consent_purpose), app.is_member(uuid), app.shared_with_me(uuid),
  app.shared_version(uuid, int), app.shared_media(uuid), app.shared_transcript_version(uuid, int),
  app.answer_rules_for(uuid, text[]) from public;
grant execute on function app.author_has_consent(uuid, consent_purpose), app.is_member(uuid), app.shared_with_me(uuid),
  app.shared_version(uuid, int), app.shared_media(uuid), app.shared_transcript_version(uuid, int),
  app.answer_rules_for(uuid, text[]) to echo_app;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on share_grant, recipient_turn, answer_report from %I', r);
      execute format('revoke all on function app.author_has_consent(uuid, consent_purpose), app.is_member(uuid), app.shared_with_me(uuid), app.shared_version(uuid, int), app.shared_media(uuid), app.shared_transcript_version(uuid, int), app.answer_rules_for(uuid, text[]) from %I', r);
    end if;
  end loop;
end $$;
