-- Community Groups: tables, RLS, helper RPCs
-- Assumes: member_profiles(user_id uuid PK -> auth.users.id) already exists.
-- ASSUMPTION: admins are marked by app_metadata.role = 'admin' in the JWT.
-- If the site already has an admin mechanism, only edit is_admin() below.

-- ---------- helpers ----------
create or replace function public.is_admin()
returns boolean
language sql stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

-- ---------- tables ----------
create table if not exists public.community_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 100),
  description text not null default '',
  is_active   boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- hosts: a group can have one or more hosts (references member_profiles so
-- the frontend can embed display_name in one query)
create table if not exists public.group_hosts (
  group_id uuid not null references public.community_groups(id) on delete cascade,
  user_id  uuid not null references public.member_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.group_memberships (
  id        uuid primary key default gen_random_uuid(),
  group_id  uuid not null references public.community_groups(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)            -- prevents duplicate memberships
);

create index if not exists group_memberships_user_idx on public.group_memberships(user_id);

-- ---------- RLS ----------
alter table public.community_groups  enable row level security;
alter table public.group_hosts       enable row level security;
alter table public.group_memberships enable row level security;

-- groups: any signed-in member can read active groups; only admins write
create policy "groups readable"   on public.community_groups
  for select to authenticated using (is_active or public.is_admin());
create policy "groups admin ins"  on public.community_groups
  for insert to authenticated with check (public.is_admin());
create policy "groups admin upd"  on public.community_groups
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "groups admin del"  on public.community_groups
  for delete to authenticated using (public.is_admin());

-- hosts: readable by members, managed by admins
create policy "hosts readable"    on public.group_hosts
  for select to authenticated using (true);
create policy "hosts admin write" on public.group_hosts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- memberships: see only your own rows; join/leave only as yourself
create policy "own memberships read"  on public.group_memberships
  for select to authenticated using (user_id = auth.uid());
create policy "own memberships join"  on public.group_memberships
  for insert to authenticated with check (user_id = auth.uid());
create policy "own memberships leave" on public.group_memberships
  for delete to authenticated using (user_id = auth.uid());
-- no UPDATE policy: memberships can't be edited, only created/deleted

-- ---------- updated_at trigger ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists community_groups_touch on public.community_groups;
create trigger community_groups_touch before update on public.community_groups
  for each row execute function public.touch_updated_at();

-- ---------- member counts (members can't read others' rows, so use RPC) ----------
create or replace function public.group_member_counts()
returns table (group_id uuid, member_count bigint)
language sql stable security definer set search_path = public
as $$
  select group_id, count(*) from public.group_memberships group by group_id;
$$;
revoke all on function public.group_member_counts() from public;
grant execute on function public.group_member_counts() to authenticated;

-- ---------- frontend usage (supabase-js) ----------
-- List groups + hosts:
--   supabase.from('community_groups')
--     .select('id,name,description, group_hosts(user_id, member_profiles(display_name))')
--     .eq('is_active', true)
-- One group:
--   ...same select... .eq('id', groupId).single()
-- Join:
--   supabase.from('group_memberships').insert({ group_id, user_id: user.id })
--   (duplicate -> error code 23505, treat as "already joined")
-- Leave:
--   supabase.from('group_memberships').delete().eq('group_id', groupId).eq('user_id', user.id)
-- My groups:
--   supabase.from('group_memberships').select('joined_at, community_groups(*)').eq('user_id', user.id)
-- Counts:
--   supabase.rpc('group_member_counts')
