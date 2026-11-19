-- Echo of Me | Migration 0015: chunked uploads (ADR-016).
-- Hosting limits each request body (about 4.5 MB on Vercel), so larger recordings and photos arrive in
-- pieces. Pieces wait here, private to the legacy's author, until the upload is finished; then the file
-- is checked and stored exactly like a single upload (vault.addMedia) and the pieces are deleted.
-- Unfinished uploads are removed after an hour.

create table upload_session (
  id             uuid primary key default gen_random_uuid(),
  legacy_id      uuid not null references legacy(id) on delete cascade,
  memory_id      uuid not null,
  created_by     uuid not null references account(id),
  capture        text not null check (capture in ('upload', 'browser_recording')),
  filename       text check (filename is null or length(filename) <= 200),
  declared_size  int not null check (declared_size between 1 and 26214400),
  chunk_size     int not null check (chunk_size between 65536 and 4194304),
  created_at     timestamptz not null default clock_timestamp(),
  unique (id, legacy_id),
  foreign key (memory_id, legacy_id) references memory_item(id, legacy_id) on delete cascade
);
create index upload_session_legacy_idx on upload_session(legacy_id, created_at);

create table upload_chunk (
  upload_id  uuid not null,
  legacy_id  uuid not null,
  seq        int not null check (seq between 0 and 511),
  bytes      bytea not null check (octet_length(bytes) between 1 and 4194304),
  primary key (upload_id, seq),
  foreign key (upload_id, legacy_id) references upload_session(id, legacy_id) on delete cascade
);

alter table upload_session enable row level security;
alter table upload_session force row level security;
alter table upload_chunk enable row level security;
alter table upload_chunk force row level security;

create policy upload_session_owner on upload_session for all to echo_app
  using (app.owns_legacy(legacy_id) and created_by = app.current_account_id())
  with check (app.owns_legacy(legacy_id) and created_by = app.current_account_id());
create policy upload_chunk_owner on upload_chunk for all to echo_app
  using (app.owns_legacy(legacy_id)) with check (app.owns_legacy(legacy_id));

grant select, insert, delete on upload_session, upload_chunk to echo_app;
create trigger upload_session_immutable before update on upload_session for each row execute function app.reject_update();
create trigger upload_chunk_immutable before update on upload_chunk for each row execute function app.reject_update();

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on upload_session, upload_chunk from %I', r);
    end if;
  end loop;
end $$;
