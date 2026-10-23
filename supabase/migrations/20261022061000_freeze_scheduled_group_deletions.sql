-- Once deletion is scheduled, freeze membership and balance changes. This
-- ensures every person affected by final deletion received the notice.
create or replace function public.reject_scheduled_group_membership_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.groups as group_row
    where group_row.id = new.group_id
      and group_row.deletion_scheduled_for is not null
  ) then
    raise exception 'This group is scheduled for deletion and cannot accept new members.';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_scheduled_group_member_insert on public.group_members;
create trigger reject_scheduled_group_member_insert
before insert on public.group_members
for each row execute function public.reject_scheduled_group_membership_change();

create or replace function public.reject_scheduled_group_receipt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.groups as group_row
    where group_row.id = new.group_id
      and group_row.deletion_scheduled_for is not null
  ) then
    raise exception 'This group is scheduled for deletion and cannot record new receipts.';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_scheduled_group_receipt_insert on public.group_receipt_transactions;
create trigger reject_scheduled_group_receipt_insert
before insert on public.group_receipt_transactions
for each row execute function public.reject_scheduled_group_receipt();

create or replace function public.update_group_savings_target(p_group_id uuid, p_target_minor bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.barkada_user_is_verified() then raise exception 'Verified email and completed profile are required.'; end if;
  if p_target_minor is null or p_target_minor < 0 then raise exception 'Savings target must be zero or greater.'; end if;
  if not exists (
    select 1 from public.group_members as member_row
    where member_row.group_id = p_group_id and member_row.profile_id = auth.uid()
      and member_row.role in ('owner', 'admin')
  ) then raise exception 'Only group owners and admins can update the savings target.'; end if;
  if exists (select 1 from public.groups as group_row where group_row.id = p_group_id and group_row.deletion_scheduled_for is not null) then
    raise exception 'This group is scheduled for deletion and cannot be changed.';
  end if;
  update public.groups set savings_target_minor = p_target_minor where id = p_group_id;
end;
$$;

revoke all on function public.update_group_savings_target(uuid, bigint) from public, anon;
grant execute on function public.update_group_savings_target(uuid, bigint) to authenticated;

create or replace function public.update_barkada_visibility(p_group_id uuid, p_is_public boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.barkada_user_is_verified() then
    raise exception 'Verified email and completed profile are required.';
  end if;
  if not exists (
    select 1 from public.group_members as owner_member
    where owner_member.group_id = p_group_id and owner_member.profile_id = auth.uid()
      and owner_member.role = 'owner'
  ) then raise exception 'Only the group owner can change group visibility.'; end if;
  if exists (select 1 from public.groups as group_row where group_row.id = p_group_id and group_row.deletion_scheduled_for is not null) then
    raise exception 'This group is scheduled for deletion and cannot be changed.';
  end if;
  update public.groups set is_public = coalesce(p_is_public, false) where id = p_group_id;
  if not found then raise exception 'This group was not found.'; end if;
end;
$$;

revoke all on function public.update_barkada_visibility(uuid, boolean) from public, anon;
grant execute on function public.update_barkada_visibility(uuid, boolean) to authenticated;
