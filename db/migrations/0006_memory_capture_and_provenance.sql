-- Echo of Me | Migration 0006: vertical slice 2, memory capture and provenance (ADR-006).
--
-- Design rules enforced here:
--  * Everything in the vault belongs to exactly one legacy. Child rows carry legacy_id and use composite
--    foreign keys (id, legacy_id), so a row can never point at another family's memory or recipient.
--  * Owner-only row-level security, as in slice 1. Recipients still get no table access (AC-02).
--  * Provenance (01B §4.3): author-written text = P2, original audio/image = P1, author-approved
--    transcript = P3, unapproved transcript or automatic suggestion = P6 (never citable).
--  * Text versions and transcript versions are append-only: an edit adds a version, nothing is overwritten.
--  * Original media rows are immutable; the bytes live in a blob store keyed "<legacy>/<asset>" and are
--    verified against the stored SHA-256 on every read (AC-03).
--  * The ONLY place later retrieval (slice 3) may read from is the view `citable_source`, which contains
--    approved material only (AC-04).

create type memory_kind       as enum ('memory', 'value_statement');
create type approval_state    as enum ('draft', 'approved');
create type sensitivity_level as enum ('standard', 'sensitive');
create type audience_mode     as enum ('only_me', 'selected');
create type media_kind        as enum ('audio', 'image');
create type capture_method    as enum ('upload', 'browser_recording');
create type transcript_origin as enum ('author_typed', 'machine');
create type tag_kind          as enum ('theme', 'person', 'value');
create type tag_origin        as enum ('author', 'automatic');
create type tag_state         as enum ('suggested', 'approved', 'rejected');

-- Lets audience rows prove that the recipient belongs to the same legacy as the memory.
alter table recipient add constraint recipient_id_legacy_key unique (id, legacy_id);

-- ---------------------------------------------------------------- memories and value statements
create table memory_item (
  id                uuid primary key default gen_random_uuid(),
  legacy_id         uuid not null references legacy(id) on delete cascade,
  kind              memory_kind not null,
  current_version   int not null default 1 check (current_version >= 1),
  approval          approval_state not null default 'draft',
  approved_version  int,
  approved_at       timestamptz,
  sensitivity       sensitivity_level not null default 'standard',
  audience          audience_mode not null default 'only_me',
  created_by        uuid not null references account(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, legacy_id),
  -- Approval always refers to the exact version that is current: any change returns the item to draft.
  constraint approval_consistent check (
    (approval = 'approved') = (approved_version is not null and approved_at is not null)
    and (approved_version is null or approved_version = current_version)
  )
);
create index memory_item_legacy_idx on memory_item(legacy_id, created_at desc);

create table memory_version (
  id              uuid primary key default gen_random_uuid(),
  memory_id       uuid not null,
  legacy_id       uuid not null,
  version_no      int not null check (version_no >= 1),
  title           text not null check (length(btrim(title)) between 1 and 160),
  body            text not null default '' check (length(body) <= 20000),
  occurred_label  text check (occurred_label is null or length(occurred_label) <= 80),
  created_by      uuid not null references account(id),
  created_at      timestamptz not null default clock_timestamp(),
  unique (memory_id, version_no),
  foreign key (memory_id, legacy_id) references memory_item(id, legacy_id) on delete cascade
);

-- The current version must exist (checked at commit, so item and first version can be inserted together).
alter table memory_item add constraint memory_item_current_version_fk
  foreign key (id, current_version) references memory_version(memory_id, version_no)
  deferrable initially deferred;

-- ---------------------------------------------------------------- original media (P1)
create table media_asset (
  id                 uuid primary key default gen_random_uuid(),
  legacy_id          uuid not null,
  memory_id          uuid not null,
  kind               media_kind not null,
  mime_type          text not null check (mime_type in (
                       'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/mp4',
                       'image/png', 'image/jpeg', 'image/webp')),
  byte_size          bigint not null check (byte_size > 0),
  sha256             text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  storage_key        text not null unique,
  original_filename  text check (original_filename is null or length(original_filename) <= 200),
  capture            capture_method not null,
  created_by         uuid not null references account(id),
  created_at         timestamptz not null default clock_timestamp(),
  unique (id, legacy_id),
  foreign key (memory_id, legacy_id) references memory_item(id, legacy_id) on delete cascade,
  constraint storage_key_scoped check (storage_key = legacy_id::text || '/' || id::text),
  constraint kind_matches_mime check ((kind = 'audio') = (mime_type like 'audio/%'))
);
create index media_asset_memory_idx on media_asset(memory_id);

-- ---------------------------------------------------------------- transcripts (P6 until approved → P3)
create table transcript (
  media_asset_id   uuid primary key,
  legacy_id        uuid not null,
  current_version  int not null check (current_version >= 1),
  approval         approval_state not null default 'draft',
  approved_at      timestamptz,
  updated_at       timestamptz not null default now(),
  unique (media_asset_id, legacy_id),
  foreign key (media_asset_id, legacy_id) references media_asset(id, legacy_id) on delete cascade,
  constraint transcript_approval_consistent check ((approval = 'approved') = (approved_at is not null))
);

create table transcript_version (
  id               uuid primary key default gen_random_uuid(),
  media_asset_id   uuid not null,
  legacy_id        uuid not null,
  version_no       int not null check (version_no >= 1),
  text             text not null check (length(btrim(text)) between 1 and 100000),
  origin           transcript_origin not null,
  created_by       uuid references account(id),     -- null when produced by a machine
  created_at       timestamptz not null default clock_timestamp(),
  unique (media_asset_id, version_no),
  foreign key (media_asset_id, legacy_id) references transcript(media_asset_id, legacy_id) on delete cascade,
  constraint author_typed_has_author check (origin = 'machine' or created_by is not null)
);

alter table transcript add constraint transcript_current_version_fk
  foreign key (media_asset_id, current_version) references transcript_version(media_asset_id, version_no)
  deferrable initially deferred;

-- ---------------------------------------------------------------- tags
create table memory_tag (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   uuid not null,
  memory_id   uuid not null,
  kind        tag_kind not null,
  label       text not null check (length(btrim(label)) between 1 and 60 and label !~ '[[:cntrl:]]'),
  origin      tag_origin not null,
  state       tag_state not null,
  decided_at  timestamptz,
  created_at  timestamptz not null default now(),
  foreign key (memory_id, legacy_id) references memory_item(id, legacy_id) on delete cascade,
  -- A tag the author typed is the author's own choice. Automatic suggestions start as 'suggested'.
  constraint author_tags_are_approved check (origin = 'automatic' or state = 'approved'),
  constraint decided_when_not_suggested check ((state = 'suggested') = (decided_at is null))
);
create unique index memory_tag_unique on memory_tag(memory_id, kind, lower(label));

-- ---------------------------------------------------------------- intended audience (grants nothing yet)
-- Who the author intends an item for. Recipients cannot read anything until the sharing slice (5) exists.
create table memory_audience (
  memory_id     uuid not null,
  recipient_id  uuid not null,
  legacy_id     uuid not null,
  created_at    timestamptz not null default now(),
  primary key (memory_id, recipient_id),
  foreign key (memory_id, legacy_id) references memory_item(id, legacy_id) on delete cascade,
  foreign key (recipient_id, legacy_id) references recipient(id, legacy_id) on delete cascade
);

-- ---------------------------------------------------------------- guards
create or replace function app.reject_update() returns trigger
language plpgsql set search_path = pg_catalog, pg_temp as $$
begin
  raise exception 'immutable: rows in % cannot be changed', tg_table_name using errcode = 'P0001';
end $$;

create trigger memory_version_immutable     before update on memory_version     for each row execute function app.reject_update();
create trigger transcript_version_immutable before update on transcript_version for each row execute function app.reject_update();
create trigger media_asset_immutable        before update on media_asset        for each row execute function app.reject_update();

create trigger memory_item_touch before update on memory_item for each row execute function app.touch_updated_at();
create trigger transcript_touch  before update on transcript  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------- citable material (the retrieval boundary)
-- Approved material only. Unapproved items, unapproved transcripts (P6) and tags never appear here.
create view citable_source with (security_invoker = true) as
select 'memory_version'::text as source_type, v.id as source_id, i.legacy_id, i.id as memory_id, i.kind,
       'P2_author_written'::text as provenance, v.title, v.body as text, null::uuid as media_asset_id,
       i.sensitivity, i.approved_at, v.version_no
  from memory_item i
  join memory_version v on v.memory_id = i.id and v.version_no = i.current_version
 where i.approval = 'approved'
union all
select 'media_asset', m.id, m.legacy_id, m.memory_id, i.kind,
       'P1_original_recording', v.title, null, m.id,
       i.sensitivity, i.approved_at, null
  from media_asset m
  join memory_item i on i.id = m.memory_id
  join memory_version v on v.memory_id = i.id and v.version_no = i.current_version
 where i.approval = 'approved'
union all
select 'transcript_version', tv.id, t.legacy_id, m.memory_id, i.kind,
       'P3_approved_transcript', v.title, tv.text, m.id,
       i.sensitivity, t.approved_at, tv.version_no
  from transcript t
  join transcript_version tv on tv.media_asset_id = t.media_asset_id and tv.version_no = t.current_version
  join media_asset m on m.id = t.media_asset_id
  join memory_item i on i.id = m.memory_id
  join memory_version v on v.memory_id = i.id and v.version_no = i.current_version
 where t.approval = 'approved' and i.approval = 'approved';

-- ---------------------------------------------------------------- row-level security (owner only)
alter table memory_item        enable row level security; alter table memory_item        force row level security;
alter table memory_version     enable row level security; alter table memory_version     force row level security;
alter table media_asset        enable row level security; alter table media_asset        force row level security;
alter table transcript         enable row level security; alter table transcript         force row level security;
alter table transcript_version enable row level security; alter table transcript_version force row level security;
alter table memory_tag         enable row level security; alter table memory_tag         force row level security;
alter table memory_audience    enable row level security; alter table memory_audience    force row level security;

create policy memory_item_owner_all on memory_item for all to echo_app
  using (app.owns_legacy(legacy_id))
  with check (app.owns_legacy(legacy_id) and created_by = app.current_account_id());
create policy memory_version_owner_select on memory_version for select to echo_app using (app.owns_legacy(legacy_id));
create policy memory_version_owner_insert on memory_version for insert to echo_app
  with check (app.owns_legacy(legacy_id) and created_by = app.current_account_id());
create policy media_asset_owner_select on media_asset for select to echo_app using (app.owns_legacy(legacy_id));
create policy media_asset_owner_insert on media_asset for insert to echo_app
  with check (app.owns_legacy(legacy_id) and created_by = app.current_account_id());
create policy media_asset_owner_delete on media_asset for delete to echo_app using (app.owns_legacy(legacy_id));
create policy transcript_owner_all on transcript for all to echo_app
  using (app.owns_legacy(legacy_id)) with check (app.owns_legacy(legacy_id));
create policy transcript_version_owner_select on transcript_version for select to echo_app using (app.owns_legacy(legacy_id));
-- The application role may only add author-typed versions as the acting author. Machine transcripts are
-- written by the same role on behalf of the author (created_by null) once a transcription provider exists.
create policy transcript_version_owner_insert on transcript_version for insert to echo_app
  with check (app.owns_legacy(legacy_id) and (created_by is null or created_by = app.current_account_id()));
create policy memory_tag_owner_all on memory_tag for all to echo_app
  using (app.owns_legacy(legacy_id)) with check (app.owns_legacy(legacy_id));
create policy memory_audience_owner_all on memory_audience for all to echo_app
  using (app.owns_legacy(legacy_id)) with check (app.owns_legacy(legacy_id));

-- ---------------------------------------------------------------- grants (no UPDATE/DELETE on version tables)
grant select, insert, update, delete on memory_item        to echo_app;
grant select, insert                 on memory_version     to echo_app;
grant select, insert, delete         on media_asset        to echo_app;
grant select, insert, update         on transcript         to echo_app;
grant select, insert                 on transcript_version to echo_app;
grant select, insert, update, delete on memory_tag         to echo_app;
grant select, insert, delete         on memory_audience    to echo_app;
grant select                         on citable_source     to echo_app;

revoke all on function app.reject_update() from public;

-- Supabase public API roles: no access to anything new (0003 also changed default privileges).
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on memory_item, memory_version, media_asset, transcript, transcript_version, memory_tag, memory_audience, citable_source from %I', r);
      execute format('revoke all on function app.reject_update() from %I', r);
    end if;
  end loop;
end $$;
