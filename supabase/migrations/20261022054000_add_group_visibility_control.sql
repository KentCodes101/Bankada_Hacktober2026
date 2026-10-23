-- Only the owner may make an existing group searchable or private.
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
    where owner_member.group_id = p_group_id
      and owner_member.profile_id = auth.uid()
      and owner_member.role = 'owner'
  ) then
    raise exception 'Only the group owner can change group visibility.';
  end if;

  update public.groups
  set is_public = coalesce(p_is_public, false)
  where id = p_group_id;

  if not found then raise exception 'This group was not found.'; end if;
end;
$$;

revoke all on function public.update_barkada_visibility(uuid, boolean) from public, anon;
grant execute on function public.update_barkada_visibility(uuid, boolean) to authenticated;
