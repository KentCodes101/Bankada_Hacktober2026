create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_public boolean not null default false,
  invite_code text unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.groups add column if not exists name text;
alter table public.groups add column if not exists is_public boolean not null default false;
alter table public.groups add column if not exists invite_code text;
alter table public.groups add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.groups add column if not exists created_at timestamptz not null default now();
create unique index if not exists groups_invite_code_key on public.groups (invite_code) where invite_code is not null;
alter table public.groups alter column invite_code set default lower(replace(gen_random_uuid()::text, '-', ''));

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  profile_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, profile_id)
);

alter table public.group_members add column if not exists role text not null default 'member';
alter table public.group_members add column if not exists joined_at timestamptz not null default now();
create unique index if not exists group_members_group_profile_key on public.group_members (group_id, profile_id);
create index if not exists group_members_profile_id_idx on public.group_members (profile_id);

create table if not exists public.group_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  profile_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  unique (group_id, profile_id)
);

create or replace function public.barkada_user_is_verified()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
      and u.phone_confirmed_at is not null
      and length(trim(coalesce(u.raw_user_meta_data ->> 'full_name', ''))) > 0
      and length(trim(coalesce(u.raw_user_meta_data ->> 'avatar_emoji', ''))) > 0
  );
$$;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_join_requests enable row level security;

drop policy if exists "Users can read public or joined groups" on public.groups;
create policy "Users can read public or joined groups"
  on public.groups for select to authenticated
  using (
    public.barkada_user_is_verified()
    and (
      is_public
      or exists (
        select 1 from public.group_members gm
        where gm.group_id = groups.id and gm.profile_id = auth.uid()
      )
    )
  );

drop policy if exists "Users can read their own memberships" on public.group_members;
create policy "Users can read their own memberships"
  on public.group_members for select to authenticated
  using (public.barkada_user_is_verified() and profile_id = auth.uid());

drop policy if exists "Users can read own requests or manage group requests" on public.group_join_requests;
create policy "Users can read own requests or manage group requests"
  on public.group_join_requests for select to authenticated
  using (
    public.barkada_user_is_verified()
    and (
      profile_id = auth.uid()
      or exists (
        select 1 from public.group_members gm
        where gm.group_id = group_join_requests.group_id
          and gm.profile_id = auth.uid()
          and gm.role in ('owner', 'admin')
      )
    )
  );

revoke all on public.groups from anon, authenticated;
grant select (id, name, is_public, created_at) on public.groups to authenticated;
revoke all on public.group_members from anon, authenticated;
grant select on public.group_members to authenticated;
revoke all on public.group_join_requests from anon, authenticated;
grant select on public.group_join_requests to authenticated;

create or replace function public.create_barkada_group(p_name text, p_is_public boolean)
returns table(group_id uuid, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  created_group public.groups%rowtype;
begin
  if not public.barkada_user_is_verified() then
    raise exception 'Verified email, phone, and completed profile are required.';
  end if;
  if length(trim(p_name)) < 2 or length(trim(p_name)) > 80 then
    raise exception 'Group name must be between 2 and 80 characters.';
  end if;

  insert into public.groups (name, is_public, created_by)
  values (trim(p_name), coalesce(p_is_public, false), current_user_id)
  returning * into created_group;

  insert into public.group_members (group_id, profile_id, role)
  values (created_group.id, current_user_id, 'owner')
  on conflict (group_id, profile_id) do nothing;

  return query select created_group.id, created_group.invite_code;
end;
$$;

create or replace function public.search_public_barkadas(p_query text)
returns table(group_id uuid, group_name text, member_count bigint, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.barkada_user_is_verified() then
    raise exception 'Verified email, phone, and completed profile are required.';
  end if;
  if length(trim(coalesce(p_query, ''))) < 2 then
    raise exception 'Enter at least 2 characters to search.';
  end if;

  return query
    select g.id, g.name,
      (select count(*) from public.group_members gm where gm.group_id = g.id),
      g.created_at
    from public.groups g
    where g.is_public
      and position(lower(trim(p_query)) in lower(g.name)) > 0
    order by g.name
    limit 25;
end;
$$;

create or replace function public.list_my_barkadas()
returns table(group_id uuid, group_name text, is_public boolean, invite_code text, role text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.barkada_user_is_verified() then
    raise exception 'Verified email, phone, and completed profile are required.';
  end if;

  return query
    select g.id, g.name, g.is_public, g.invite_code, gm.role
    from public.group_members gm
    join public.groups g on g.id = gm.group_id
    where gm.profile_id = auth.uid()
    order by g.name;
end;
$$;

create or replace function public.request_to_join_barkada(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if not public.barkada_user_is_verified() then
    raise exception 'Verified email, phone, and completed profile are required.';
  end if;
  if not exists (select 1 from public.groups g where g.id = p_group_id and g.is_public) then
    raise exception 'This public group was not found.';
  end if;
  if exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.profile_id = current_user_id
  ) then
    raise exception 'You are already a member of this group.';
  end if;

  insert into public.group_join_requests (group_id, profile_id, status, requested_at, reviewed_by, reviewed_at)
  values (p_group_id, current_user_id, 'pending', now(), null, null)
  on conflict (group_id, profile_id) do update
    set status = 'pending', requested_at = now(), reviewed_by = null, reviewed_at = null;
end;
$$;

create or replace function public.join_barkada_by_invite(p_invite_code text)
returns table(group_id uuid, group_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_group public.groups%rowtype;
begin
  if not public.barkada_user_is_verified() then
    raise exception 'Verified email, phone, and completed profile are required.';
  end if;

  select g.* into target_group
  from public.groups g
  where lower(g.invite_code) = lower(trim(p_invite_code))
  limit 1;
  if target_group.id is null then
    raise exception 'Invite code is invalid.';
  end if;

  insert into public.group_members (group_id, profile_id, role)
  values (target_group.id, current_user_id, 'member')
  on conflict (group_id, profile_id) do nothing;

  return query select target_group.id, target_group.name;
end;
$$;

create or replace function public.list_barkada_join_requests(p_group_id uuid)
returns table(request_id uuid, requester_id uuid, display_name text, avatar_emoji text, requested_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.barkada_user_is_verified() or not exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id
      and gm.profile_id = auth.uid()
      and gm.role in ('owner', 'admin')
  ) then
    raise exception 'Only group owners and admins can view join requests.';
  end if;

  return query
    select r.id, r.profile_id,
      coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), 'Bankada member'),
      coalesce(u.raw_user_meta_data ->> 'avatar_emoji', ''),
      r.requested_at
    from public.group_join_requests r
    join auth.users u on u.id = r.profile_id
    where r.group_id = p_group_id and r.status = 'pending'
    order by r.requested_at;
end;
$$;

create or replace function public.review_barkada_join_request(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_request public.group_join_requests%rowtype;
begin
  if not public.barkada_user_is_verified() then
    raise exception 'Verified email, phone, and completed profile are required.';
  end if;

  select r.* into target_request
  from public.group_join_requests r
  where r.id = p_request_id and r.status = 'pending'
  for update;
  if target_request.id is null then
    raise exception 'This join request is no longer pending.';
  end if;
  if not exists (
    select 1 from public.group_members gm
    where gm.group_id = target_request.group_id
      and gm.profile_id = current_user_id
      and gm.role in ('owner', 'admin')
  ) then
    raise exception 'Only group owners and admins can review join requests.';
  end if;

  update public.group_join_requests
  set status = case when p_approve then 'approved' else 'declined' end,
      reviewed_by = current_user_id,
      reviewed_at = now()
  where id = target_request.id;

  if p_approve then
    insert into public.group_members (group_id, profile_id, role)
    values (target_request.group_id, target_request.profile_id, 'member')
    on conflict (group_id, profile_id) do nothing;
  end if;
end;
$$;

revoke all on function public.create_barkada_group(text, boolean) from public, anon;
revoke all on function public.search_public_barkadas(text) from public, anon;
revoke all on function public.list_my_barkadas() from public, anon;
revoke all on function public.request_to_join_barkada(uuid) from public, anon;
revoke all on function public.join_barkada_by_invite(text) from public, anon;
revoke all on function public.list_barkada_join_requests(uuid) from public, anon;
revoke all on function public.review_barkada_join_request(uuid, boolean) from public, anon;
revoke all on function public.barkada_user_is_verified() from public, anon;
grant execute on function public.create_barkada_group(text, boolean) to authenticated;
grant execute on function public.search_public_barkadas(text) to authenticated;
grant execute on function public.list_my_barkadas() to authenticated;
grant execute on function public.request_to_join_barkada(uuid) to authenticated;
grant execute on function public.join_barkada_by_invite(text) to authenticated;
grant execute on function public.list_barkada_join_requests(uuid) to authenticated;
grant execute on function public.review_barkada_join_request(uuid, boolean) to authenticated;
grant execute on function public.barkada_user_is_verified() to authenticated;
