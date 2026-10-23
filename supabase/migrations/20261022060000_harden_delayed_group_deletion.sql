-- Finalisation must not depend on a member opening the web app. Configure this
-- function as a Supabase Cron database-function job (for example every 15
-- minutes) after deploying; only the database owner/service role can run it.
revoke all on function public.finalize_due_barkada_group_deletions() from authenticated;
grant execute on function public.finalize_due_barkada_group_deletions() to service_role;

create or replace function public.get_barkada_deletion_status(p_group_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.barkada_user_is_verified() or not exists (
    select 1 from public.group_members as member_row
    where member_row.group_id = p_group_id and member_row.profile_id = auth.uid()
  ) then
    raise exception 'Only group members can view this group.';
  end if;

  return (select deletion_scheduled_for from public.groups where id = p_group_id);
end;
$$;

create or replace function public.cancel_barkada_group_deletion(p_group_id uuid)
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
    where owner_member.group_id = p_group_id
      and owner_member.profile_id = auth.uid()
      and owner_member.role = 'owner'
  ) then
    raise exception 'Only the group owner can cancel deletion.';
  end if;

  update public.groups as group_row
  set deletion_requested_at = null,
      deletion_scheduled_for = null,
      deletion_requested_by = null
  where group_row.id = p_group_id
    and group_row.deletion_scheduled_for > now();

  if not found then
    raise exception 'There is no pending group deletion to cancel.';
  end if;
end;
$$;

revoke all on function public.get_barkada_deletion_status(uuid), public.cancel_barkada_group_deletion(uuid) from public, anon;
grant execute on function public.get_barkada_deletion_status(uuid), public.cancel_barkada_group_deletion(uuid) to authenticated;
