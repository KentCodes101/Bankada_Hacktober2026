-- In-app deletion notifications. Each current member gets an immutable notice
-- in the same transaction that schedules deletion, so no external mail service
-- or client-side fan-out is required.
create table if not exists public.group_deletion_notifications (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  group_name text not null,
  scheduled_for timestamptz not null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  read_at timestamptz,
  unique (group_id, recipient_id, scheduled_for)
);
create index if not exists group_deletion_notifications_recipient_idx
  on public.group_deletion_notifications (recipient_id, cancelled_at, scheduled_for desc);

alter table public.group_deletion_notifications enable row level security;
revoke all on public.group_deletion_notifications from anon, authenticated;
create policy "Users can read their group deletion notifications"
  on public.group_deletion_notifications for select to authenticated
  using (recipient_id = auth.uid());
grant select on public.group_deletion_notifications to authenticated;

create or replace function public.request_barkada_group_deletion(p_group_id uuid)
returns table(group_name text, deletion_scheduled_for timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare scheduled_at timestamptz := now() + interval '3 days'; target_group public.groups%rowtype;
begin
  if not public.barkada_user_is_verified() then raise exception 'Verified email and completed profile are required.'; end if;
  if not exists (
    select 1 from public.group_members as owner_member
    where owner_member.group_id = p_group_id and owner_member.profile_id = auth.uid()
      and owner_member.role = 'owner'
  ) then raise exception 'Only the group owner can request deletion.'; end if;

  select * into target_group from public.groups as group_row where group_row.id = p_group_id for update;
  if target_group.id is null then raise exception 'This group was not found.'; end if;
  if target_group.deletion_scheduled_for is not null then raise exception 'This group is already scheduled for deletion.'; end if;

  update public.groups
  set deletion_requested_at = now(), deletion_scheduled_for = scheduled_at, deletion_requested_by = auth.uid()
  where id = p_group_id;

  insert into public.group_deletion_notifications (group_id, recipient_id, group_name, scheduled_for)
  select p_group_id, member_row.profile_id, target_group.name, scheduled_at
  from public.group_members as member_row
  where member_row.group_id = p_group_id;

  return query select target_group.name, scheduled_at;
end;
$$;

create or replace function public.cancel_barkada_group_deletion(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.barkada_user_is_verified() then raise exception 'Verified email and completed profile are required.'; end if;
  if not exists (
    select 1 from public.group_members as owner_member
    where owner_member.group_id = p_group_id and owner_member.profile_id = auth.uid()
      and owner_member.role = 'owner'
  ) then raise exception 'Only the group owner can cancel deletion.'; end if;

  update public.groups as group_row
  set deletion_requested_at = null, deletion_scheduled_for = null, deletion_requested_by = null
  where group_row.id = p_group_id and group_row.deletion_scheduled_for > now();
  if not found then raise exception 'There is no pending group deletion to cancel.'; end if;

  update public.group_deletion_notifications
  set cancelled_at = now()
  where group_id = p_group_id and cancelled_at is null;
end;
$$;

create or replace function public.list_my_group_deletion_notifications()
returns table(notification_id uuid, group_id uuid, group_name text, scheduled_for timestamptz, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.barkada_user_is_verified() then raise exception 'Verified email and completed profile are required.'; end if;
  return query
  select notice.id, notice.group_id, notice.group_name, notice.scheduled_for, notice.created_at
  from public.group_deletion_notifications as notice
  where notice.recipient_id = auth.uid()
    and notice.cancelled_at is null
  order by notice.scheduled_for asc;
end;
$$;

revoke all on function public.request_barkada_group_deletion(uuid), public.cancel_barkada_group_deletion(uuid), public.list_my_group_deletion_notifications() from public, anon;
grant execute on function public.request_barkada_group_deletion(uuid), public.cancel_barkada_group_deletion(uuid), public.list_my_group_deletion_notifications() to authenticated;
