-- `profile_id` is an output field of this RPC. Qualify membership-table
-- columns in its authorization check so PL/pgSQL never confuses that output
-- variable with a column.
create or replace function public.list_barkada_members(p_group_id uuid)
returns table(
  profile_id uuid,
  display_name text,
  avatar_emoji text,
  role text,
  joined_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.barkada_user_is_verified() or not exists (
    select 1
    from public.group_members as requesting_member
    where requesting_member.group_id = p_group_id
      and requesting_member.profile_id = auth.uid()
  ) then
    raise exception 'Only group members can view this group.';
  end if;

  return query
  select
    member_row.profile_id,
    coalesce(nullif(trim(user_row.raw_user_meta_data ->> 'full_name'), ''), 'Bankada member'),
    coalesce(user_row.raw_user_meta_data ->> 'avatar_emoji', ''),
    member_row.role,
    member_row.joined_at
  from public.group_members as member_row
  join auth.users as user_row on user_row.id = member_row.profile_id
  where member_row.group_id = p_group_id
  order by case member_row.role when 'owner' then 0 when 'admin' then 1 else 2 end, member_row.joined_at;
end;
$$;

revoke all on function public.list_barkada_members(uuid) from public, anon;
grant execute on function public.list_barkada_members(uuid) to authenticated;
