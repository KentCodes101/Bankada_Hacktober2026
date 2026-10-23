alter table public.groups
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deletion_scheduled_for timestamptz,
  add column if not exists deletion_requested_by uuid references auth.users(id) on delete set null;

create or replace function public.request_barkada_group_deletion(p_group_id uuid)
returns table(group_name text, deletion_scheduled_for timestamptz)
language plpgsql security definer set search_path = public as $$
declare scheduled_at timestamptz := now() + interval '3 days';
begin
  if not public.barkada_user_is_verified() then raise exception 'Verified email and completed profile are required.'; end if;
  if not exists (select 1 from public.group_members as owner_member where owner_member.group_id = p_group_id and owner_member.profile_id = auth.uid() and owner_member.role = 'owner') then
    raise exception 'Only the group owner can request deletion.';
  end if;
  if exists (select 1 from public.groups as group_row where group_row.id = p_group_id and group_row.deletion_scheduled_for is not null) then
    raise exception 'This group is already scheduled for deletion.';
  end if;
  update public.groups as group_row
  set deletion_requested_at = now(), deletion_scheduled_for = scheduled_at, deletion_requested_by = auth.uid()
  where group_row.id = p_group_id
  returning group_row.name, group_row.deletion_scheduled_for into group_name, deletion_scheduled_for;
  if not found then raise exception 'This group was not found.'; end if;
  return next;
end;
$$;

create or replace function public.finalize_due_barkada_group_deletions()
returns integer
language plpgsql security definer set search_path = public as $$
declare group_row record; deleted_count integer := 0;
begin
  for group_row in select id from public.groups where deletion_scheduled_for <= now() for update loop
    delete from storage.objects
    where bucket_id = 'group-receipts' and (storage.foldername(name))[1] = group_row.id::text;
    delete from public.groups where id = group_row.id;
    deleted_count := deleted_count + 1;
  end loop;
  return deleted_count;
end;
$$;

revoke all on function public.request_barkada_group_deletion(uuid), public.finalize_due_barkada_group_deletions() from public, anon;
grant execute on function public.request_barkada_group_deletion(uuid), public.finalize_due_barkada_group_deletions() to authenticated;
