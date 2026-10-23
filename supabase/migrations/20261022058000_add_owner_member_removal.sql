-- Membership removal is intentionally restricted to the group owner.  The
-- owner cannot remove themself, which prevents a group from becoming ownerless.
create or replace function public.remove_barkada_member(
  p_group_id uuid,
  p_profile_id uuid
)
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
    raise exception 'Only the group owner can remove members.';
  end if;

  if p_profile_id = auth.uid() then
    raise exception 'The group owner cannot remove themself.';
  end if;

  delete from public.group_members as member_row
  where member_row.group_id = p_group_id
    and member_row.profile_id = p_profile_id
    and member_row.role <> 'owner';

  if not found then
    raise exception 'This member could not be removed.';
  end if;
end;
$$;

revoke all on function public.remove_barkada_member(uuid, uuid) from public, anon;
grant execute on function public.remove_barkada_member(uuid, uuid) to authenticated;
