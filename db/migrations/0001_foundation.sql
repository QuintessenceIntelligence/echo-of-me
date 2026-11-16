-- Echo of Me | Migration 0001: foundation for vertical slice 1 (author consent & onboarding)
-- ADR-003 (data platform), ADR-005 (isolation & policy enforcement).
--
-- Design rules enforced here:
--  * Runtime code runs as role `echo_app` (no BYPASSRLS, not table owner) → row-level security always applies.
--  * Every legacy-scoped table is visible only to the legacy owner (author) in this slice.
--  * Recipients get NO table access to a legacy. Adding a recipient grants nothing (AC-02).
--  * consent_event, audit_event and consent_document are append-only (no UPDATE/DELETE, enforced twice:
--    by grants and by triggers).
--  * Minors exist only as records: they can never hold an account link or an invitation (DR-026, G2 default).

create extension if not exists pgcrypto;
create extension if not exists citext;

create schema if not exists app;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'echo_app') then
    create role echo_app nologin;
  end if;
end $$;

-- The acting account for the current transaction. Set by the application with
--   select set_config('app.account_id', '<uuid>', true)
-- An unset value yields NULL, which matches no row.
create or replace function app.current_account_id() returns uuid
language sql stable as $$
  select nullif(current_setting('app.account_id', true), '')::uuid
$$;

-- ---------------------------------------------------------------- types
create type legacy_state as enum (
  'draft', 'active', 'prepared', 'activation_pending', 'verification_required',
  'frozen', 'suspended', 'archived'            -- full lifecycle from 01B §4.10; slice 1 uses draft/active only
);
create type recipient_relationship as enum (
  'child', 'stepchild', 'grandchild', 'partner', 'sibling', 'other_family', 'friend', 'other'
);
create type invitation_status as enum ('not_invited', 'invited', 'accepted', 'revoked');
create type consent_purpose as enum (
  'terms_of_service', 'privacy_notice', 'ai_processing', 'share_with_recipients',
  'audio_recording', 'recipient_terms'
);
create type consent_action as enum ('granted', 'withdrawn');
create type audit_outcome as enum ('success', 'denied', 'error');

-- ---------------------------------------------------------------- tables
create table account (
  id            uuid primary key default gen_random_uuid(),
  auth_subject  text not null unique,           -- subject from the identity provider (ADR-004)
  email         citext not null unique,
  display_name  text not null check (length(btrim(display_name)) between 1 and 120),
  created_at    timestamptz not null default now()
);

create table legacy (
  id                   uuid primary key default gen_random_uuid(),
  owner_account_id     uuid not null references account(id),
  title                text not null check (length(btrim(title)) between 1 and 160),
  author_display_name  text not null check (length(btrim(author_display_name)) between 1 and 120),
  about                text check (about is null or length(about) <= 2000),
  state                legacy_state not null default 'draft',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index legacy_owner_idx on legacy(owner_account_id);

create table recipient (
  id                 uuid primary key default gen_random_uuid(),
  legacy_id          uuid not null references legacy(id) on delete cascade,
  display_name       text not null check (length(btrim(display_name)) between 1 and 120),
  relationship       recipient_relationship not null,
  is_minor           boolean not null,
  email              citext,
  invitation_status  invitation_status not null default 'not_invited',
  account_id         uuid references account(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Minors are records only: no login, no invitation (G2 recommended default, DR-026).
  constraint minor_is_record_only check (
    not is_minor or (account_id is null and invitation_status = 'not_invited')
  ),
  constraint invitation_needs_email check (invitation_status = 'not_invited' or email is not null),
  constraint accepted_has_account check ((invitation_status = 'accepted') = (account_id is not null))
);
create index recipient_legacy_idx on recipient(legacy_id);
create unique index recipient_unique_email_per_legacy on recipient(legacy_id, email) where email is not null;

create table invitation (
  id                      uuid primary key default gen_random_uuid(),
  recipient_id            uuid not null references recipient(id) on delete cascade,
  legacy_id               uuid not null references legacy(id) on delete cascade,
  token_sha256            text not null unique,      -- only the hash is stored; the token is shown once
  created_at              timestamptz not null default now(),
  expires_at              timestamptz not null,
  accepted_at             timestamptz,
  accepted_by_account_id  uuid references account(id),
  revoked_at              timestamptz,
  revoked_reason          text
);
create index invitation_recipient_idx on invitation(recipient_id);

create table trusted_contact (
  id            uuid primary key default gen_random_uuid(),
  legacy_id     uuid not null references legacy(id) on delete cascade,
  display_name  text not null check (length(btrim(display_name)) between 1 and 120),
  email         citext,
  relationship  text check (relationship is null or length(relationship) <= 80),
  created_at    timestamptz not null default now()
  -- Record only: a trusted contact has no login and no powers in MVP-1 (DR-042).
);
create index trusted_contact_legacy_idx on trusted_contact(legacy_id);

create table consent_document (
  id            uuid primary key default gen_random_uuid(),
  purpose       consent_purpose not null,
  version       text not null,
  title         text not null,
  body          text not null,
  body_sha256   text not null,                  -- set by trigger; proves which exact text was agreed to
  legal_review_status text not null default 'draft_not_reviewed'
                check (legal_review_status in ('draft_not_reviewed', 'reviewed')),
  published_at  timestamptz not null default now(),
  unique (purpose, version),
  unique (id, purpose)
);

create table consent_event (
  id                   uuid primary key default gen_random_uuid(),
  account_id           uuid not null references account(id),
  legacy_id            uuid,            -- null = account-level consent; no FK so deletion cannot rewrite history
  purpose              consent_purpose not null,
  consent_document_id  uuid not null,
  action               consent_action not null,
  recorded_at          timestamptz not null default clock_timestamp(),
  -- The document must be a version of the same purpose.
  foreign key (consent_document_id, purpose) references consent_document(id, purpose)
);
create index consent_event_account_idx on consent_event(account_id, purpose, recorded_at desc);

create table audit_event (
  id                uuid primary key default gen_random_uuid(),
  occurred_at       timestamptz not null default clock_timestamp(),
  actor_account_id  uuid,
  legacy_id         uuid,               -- no FK: the log must survive deletion of what it describes
  action            text not null check (action ~ '^[a-z_]+(\.[a-z_]+)+$'),
  target_type       text,
  target_id         uuid,
  outcome           audit_outcome not null default 'success',
  detail            jsonb not null default '{}'::jsonb   -- minimised: identifiers and codes, never content
);
create index audit_event_legacy_idx on audit_event(legacy_id, occurred_at desc);
create index audit_event_actor_idx on audit_event(actor_account_id, occurred_at desc);

-- Latest consent state per (account, legacy scope, purpose).
create view current_consent with (security_invoker = true) as
select distinct on (e.account_id, coalesce(e.legacy_id, '00000000-0000-0000-0000-000000000000'::uuid), e.purpose)
       e.account_id, e.legacy_id, e.purpose, e.action, e.recorded_at,
       e.consent_document_id, d.version as document_version, d.body_sha256
  from consent_event e
  join consent_document d on d.id = e.consent_document_id
 order by e.account_id, coalesce(e.legacy_id, '00000000-0000-0000-0000-000000000000'::uuid), e.purpose,
          e.recorded_at desc, e.id desc;

-- ---------------------------------------------------------------- append-only guards
create or replace function app.reject_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'append_only: % is append-only', tg_table_name using errcode = 'P0001';
end $$;

create trigger consent_event_append_only before update or delete on consent_event
  for each row execute function app.reject_mutation();
create trigger audit_event_append_only before update or delete on audit_event
  for each row execute function app.reject_mutation();
create trigger consent_document_immutable before update or delete on consent_document
  for each row execute function app.reject_mutation();

create or replace function app.hash_consent_body() returns trigger language plpgsql as $$
begin new.body_sha256 := encode(sha256(convert_to(new.body, 'UTF8')), 'hex'); return new; end $$;
create trigger consent_document_hash before insert on consent_document
  for each row execute function app.hash_consent_body();

create or replace function app.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger legacy_touch before update on legacy for each row execute function app.touch_updated_at();
create trigger recipient_touch before update on recipient for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------- row-level security
alter table account          enable row level security;  alter table account          force row level security;
alter table legacy           enable row level security;  alter table legacy           force row level security;
alter table recipient        enable row level security;  alter table recipient        force row level security;
alter table invitation       enable row level security;  alter table invitation       force row level security;
alter table trusted_contact  enable row level security;  alter table trusted_contact  force row level security;
alter table consent_document enable row level security;  alter table consent_document force row level security;
alter table consent_event    enable row level security;  alter table consent_event    force row level security;
alter table audit_event      enable row level security;  alter table audit_event      force row level security;

-- account: each person sees and edits only their own row. Provisioning happens in the system context.
create policy account_self_select on account for select to echo_app using (id = app.current_account_id());
create policy account_self_update on account for update to echo_app
  using (id = app.current_account_id()) with check (id = app.current_account_id());

-- legacy: owner only (recipients receive nothing in slice 1; content grants arrive in slice 5).
create policy legacy_owner_all on legacy for all to echo_app
  using (owner_account_id = app.current_account_id())
  with check (owner_account_id = app.current_account_id());

-- Helper used by child-table policies. Runs with the caller's rights, so it can only see legacies
-- that the caller can already see.
create or replace function app.owns_legacy(p_legacy uuid) returns boolean
language sql stable as $$
  select exists (select 1 from legacy l where l.id = p_legacy and l.owner_account_id = app.current_account_id())
$$;

create policy recipient_owner_all on recipient for all to echo_app
  using (app.owns_legacy(legacy_id)) with check (app.owns_legacy(legacy_id));
create policy invitation_owner_all on invitation for all to echo_app
  using (app.owns_legacy(legacy_id)) with check (app.owns_legacy(legacy_id));
create policy trusted_contact_owner_all on trusted_contact for all to echo_app
  using (app.owns_legacy(legacy_id)) with check (app.owns_legacy(legacy_id));

-- consent documents are public texts.
create policy consent_document_read on consent_document for select to echo_app using (true);

-- consent events: a person sees and records only their own; legacy-scoped consent only for a legacy they own.
create policy consent_event_self_select on consent_event for select to echo_app
  using (account_id = app.current_account_id());
create policy consent_event_self_insert on consent_event for insert to echo_app
  with check (account_id = app.current_account_id()
              and (legacy_id is null or app.owns_legacy(legacy_id)));

-- audit: the author sees the transparency log of their legacy; anyone sees events they performed.
create policy audit_select on audit_event for select to echo_app
  using (actor_account_id = app.current_account_id()
         or (legacy_id is not null and app.owns_legacy(legacy_id)));
create policy audit_insert on audit_event for insert to echo_app
  with check (actor_account_id = app.current_account_id());

-- ---------------------------------------------------------------- narrowly scoped privileged functions
-- Accepting an invitation must read a recipient row the caller does not own. Instead of widening RLS,
-- one SECURITY DEFINER function does exactly this, with its own checks.
create or replace function app.accept_invitation(p_token text)
returns table (status text, legacy_id uuid, recipient_id uuid)
language plpgsql security definer set search_path = public, app, pg_temp as $$
-- Returns a status instead of raising, so that the audit record of a refused attempt is kept.
declare
  v_me     uuid := app.current_account_id();
  v_email  citext;
  v_inv    invitation%rowtype;
  v_rec    recipient%rowtype;
  v_reason text;
begin
  if v_me is null then
    return query select 'not_authenticated'::text, null::uuid, null::uuid; return;
  end if;
  select a.email into v_email from account a where a.id = v_me;

  select * into v_inv from invitation i
   where i.token_sha256 = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
   for update;
  v_reason := case when v_inv.id is null then 'unknown_token'
                   when v_inv.revoked_at is not null then 'revoked'
                   when v_inv.accepted_at is not null then 'already_used'
                   when v_inv.expires_at < now() then 'expired' end;

  if v_reason is null then
    select * into v_rec from recipient r where r.id = v_inv.recipient_id for update;
    if exists (select 1 from legacy l where l.id = v_inv.legacy_id and l.owner_account_id = v_me) then
      v_reason := 'own_legacy';
    elsif v_rec.is_minor or v_rec.email is null or lower(v_rec.email::text) <> lower(v_email::text) then
      v_reason := 'email_mismatch';
    end if;
  end if;

  if v_reason is not null then
    insert into audit_event(actor_account_id, legacy_id, action, target_type, target_id, outcome, detail)
    values (v_me, v_inv.legacy_id, 'invitation.accept', 'invitation', v_inv.id, 'denied',
            jsonb_build_object('reason', v_reason));
    return query select v_reason, null::uuid, null::uuid; return;
  end if;

  update invitation set accepted_at = now(), accepted_by_account_id = v_me where id = v_inv.id;
  update recipient set invitation_status = 'accepted', account_id = v_me where id = v_rec.id;
  insert into audit_event(actor_account_id, legacy_id, action, target_type, target_id, outcome)
  values (v_me, v_inv.legacy_id, 'invitation.accept', 'recipient', v_rec.id, 'success');

  return query select 'accepted'::text, v_inv.legacy_id, v_rec.id;
end $$;

-- What a signed-in recipient may know about legacies they joined: the legacy title, the author's
-- display name and the fact that nothing is shared yet. No content, no other recipients.
create or replace function app.my_recipient_memberships()
returns table (legacy_id uuid, legacy_title text, author_display_name text, accepted_at timestamptz)
language sql stable security definer set search_path = public, app, pg_temp as $$
  select l.id, l.title, l.author_display_name, i.accepted_at
    from recipient r
    join legacy l on l.id = r.legacy_id
    join invitation i on i.recipient_id = r.id and i.accepted_at is not null
   where r.account_id = app.current_account_id()
     and r.invitation_status = 'accepted'
$$;

revoke all on function app.accept_invitation(text) from public;
revoke all on function app.my_recipient_memberships() from public;

-- ---------------------------------------------------------------- grants
grant usage on schema public, app to echo_app;
grant execute on function app.current_account_id(), app.owns_legacy(uuid),
                          app.accept_invitation(text), app.my_recipient_memberships() to echo_app;
grant select, update                 on account          to echo_app;
grant select, insert, update, delete on legacy           to echo_app;
grant select, insert, update, delete on recipient        to echo_app;
grant select, insert, update, delete on invitation       to echo_app;
grant select, insert, update, delete on trusted_contact  to echo_app;
grant select                         on consent_document to echo_app;
grant select, insert                 on consent_event    to echo_app;
grant select, insert                 on audit_event      to echo_app;
grant select                         on current_consent  to echo_app;
