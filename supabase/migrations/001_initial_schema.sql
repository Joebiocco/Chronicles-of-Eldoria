-- Chronicles of Eldoria: optional Supabase cloud-save schema
-- Apply after enabling Supabase Auth. The browser game remains local-first until
-- src/main.js is intentionally wired to SupabaseAccountRepository.

begin;

create table if not exists public.eldoria_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_id uuid not null,
  settings jsonb not null default '{}'::jsonb,
  mods jsonb not null default '[]'::jsonb,
  active_slot smallint null check (active_slot between 0 and 2),
  sync_revision bigint not null default 0 check (sync_revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.eldoria_characters (
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null,
  slot smallint not null check (slot between 0 and 2),
  name text not null check (char_length(name) between 1 and 24),
  revision bigint not null default 1 check (revision >= 1),
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, slot),
  unique (user_id, character_id)
);

create index if not exists eldoria_characters_updated_at_idx
  on public.eldoria_characters (user_id, updated_at desc);

alter table public.eldoria_profiles enable row level security;
alter table public.eldoria_characters enable row level security;

create policy "Users can read their Eldoria profile"
  on public.eldoria_profiles for select
  using (auth.uid() = user_id);

create policy "Users can create their Eldoria profile"
  on public.eldoria_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update their Eldoria profile"
  on public.eldoria_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their Eldoria profile"
  on public.eldoria_profiles for delete
  using (auth.uid() = user_id);

create policy "Users can read their Eldoria characters"
  on public.eldoria_characters for select
  using (auth.uid() = user_id);

create policy "Users can create their Eldoria characters"
  on public.eldoria_characters for insert
  with check (auth.uid() = user_id);

create policy "Users can update their Eldoria characters"
  on public.eldoria_characters for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their Eldoria characters"
  on public.eldoria_characters for delete
  using (auth.uid() = user_id);

-- Optional RPC for conflict-aware profile writes. Character rows already carry
-- their own monotonic revision inside both the row and the JSON state.
create or replace function public.save_eldoria_profile(
  p_account_id uuid,
  p_settings jsonb,
  p_mods jsonb,
  p_active_slot smallint,
  p_expected_revision bigint
) returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  next_revision bigint;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;

  if p_active_slot is not null and (p_active_slot < 0 or p_active_slot > 2) then
    raise exception 'active slot must be between 0 and 2';
  end if;

  insert into public.eldoria_profiles (
    user_id, account_id, settings, mods, active_slot, sync_revision, updated_at
  )
  select
    v_user_id, p_account_id, coalesce(p_settings, '{}'::jsonb),
    coalesce(p_mods, '[]'::jsonb), p_active_slot, 1, now()
  where p_expected_revision = 0
  on conflict (user_id) do update set
    account_id = excluded.account_id,
    settings = excluded.settings,
    mods = excluded.mods,
    active_slot = excluded.active_slot,
    sync_revision = public.eldoria_profiles.sync_revision + 1,
    updated_at = now()
  where public.eldoria_profiles.sync_revision = p_expected_revision
  returning sync_revision into next_revision;

  if next_revision is null then
    raise exception using
      errcode = '40001',
      message = 'Eldoria cloud save conflict: remote revision changed';
  end if;

  return next_revision;
end;
$$;

grant execute on function public.save_eldoria_profile(uuid, jsonb, jsonb, smallint, bigint) to authenticated;

-- Preferred cloud-save RPC. Profile metadata and all occupied character slots
-- are committed atomically, so a failed character write cannot leave the cloud
-- profile revision ahead of the actual save payload.
create or replace function public.save_eldoria_account(
  p_account_id uuid,
  p_settings jsonb,
  p_mods jsonb,
  p_active_slot smallint,
  p_expected_revision bigint,
  p_characters jsonb
) returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  next_revision bigint;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;

  if p_active_slot is not null and (p_active_slot < 0 or p_active_slot > 2) then
    raise exception 'active slot must be between 0 and 2';
  end if;

  if jsonb_typeof(coalesce(p_characters, '[]'::jsonb)) <> 'array' then
    raise exception 'characters payload must be a JSON array';
  end if;

  insert into public.eldoria_profiles (
    user_id, account_id, settings, mods, active_slot, sync_revision, updated_at
  )
  select
    v_user_id, p_account_id, coalesce(p_settings, '{}'::jsonb),
    coalesce(p_mods, '[]'::jsonb), p_active_slot, 1, now()
  where p_expected_revision = 0
  on conflict (user_id) do update set
    account_id = excluded.account_id,
    settings = excluded.settings,
    mods = excluded.mods,
    active_slot = excluded.active_slot,
    sync_revision = public.eldoria_profiles.sync_revision + 1,
    updated_at = now()
  where public.eldoria_profiles.sync_revision = p_expected_revision
  returning sync_revision into next_revision;

  if next_revision is null then
    raise exception using
      errcode = '40001',
      message = 'Eldoria cloud save conflict: remote revision changed';
  end if;

  delete from public.eldoria_characters existing
  where existing.user_id = v_user_id
    and not exists (
      select 1
      from jsonb_to_recordset(coalesce(p_characters, '[]'::jsonb)) as incoming(
        slot smallint,
        character_id uuid,
        name text,
        revision bigint,
        state jsonb
      )
      where incoming.slot = existing.slot
    );

  insert into public.eldoria_characters (
    user_id, character_id, slot, name, revision, state, updated_at
  )
  select
    v_user_id,
    incoming.character_id,
    incoming.slot,
    incoming.name,
    greatest(1, incoming.revision),
    incoming.state,
    now()
  from jsonb_to_recordset(coalesce(p_characters, '[]'::jsonb)) as incoming(
    slot smallint,
    character_id uuid,
    name text,
    revision bigint,
    state jsonb
  )
  where incoming.slot between 0 and 2
    and incoming.character_id is not null
    and incoming.state is not null
  on conflict (user_id, slot) do update set
    character_id = excluded.character_id,
    name = excluded.name,
    revision = excluded.revision,
    state = excluded.state,
    updated_at = now();

  return next_revision;
end;
$$;

grant execute on function public.save_eldoria_account(uuid, jsonb, jsonb, smallint, bigint, jsonb) to authenticated;


-- Optional rolling snapshots for user-initiated cloud backups. The runtime
-- adapter does not create these automatically; an authenticated UI can add a
-- "Create cloud snapshot" action later without changing the main save tables.
create table if not exists public.eldoria_save_snapshots (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  revision bigint not null default 0,
  label text null check (label is null or char_length(label) <= 80),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists eldoria_snapshots_user_created_idx
  on public.eldoria_save_snapshots (user_id, created_at desc);

alter table public.eldoria_save_snapshots enable row level security;

create policy "Users can read their Eldoria snapshots"
  on public.eldoria_save_snapshots for select
  using (auth.uid() = user_id);
create policy "Users can create their Eldoria snapshots"
  on public.eldoria_save_snapshots for insert
  with check (auth.uid() = user_id);
create policy "Users can delete their Eldoria snapshots"
  on public.eldoria_save_snapshots for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.eldoria_profiles to authenticated;
grant select, insert, update, delete on public.eldoria_characters to authenticated;
grant select, insert, delete on public.eldoria_save_snapshots to authenticated;
grant usage, select on sequence public.eldoria_save_snapshots_id_seq to authenticated;

commit;
