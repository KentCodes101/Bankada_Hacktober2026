-- `create_barkada_group` returns a column named group_id. In PL/pgSQL that
-- output variable can clash with an unqualified conflict-target column during
-- its owner-membership insert. Leaving the conflict target unspecified keeps
-- the idempotency behavior and removes the ambiguous reference.
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
    raise exception 'Verified email and completed profile are required.';
  end if;
  if length(trim(coalesce(p_name, ''))) < 2 or length(trim(p_name)) > 80 then
    raise exception 'Group name must be between 2 and 80 characters.';
  end if;

  insert into public.groups (name, is_public, created_by)
  values (trim(p_name), coalesce(p_is_public, false), current_user_id)
  returning * into created_group;

  insert into public.group_members (group_id, profile_id, role)
  values (created_group.id, current_user_id, 'owner')
  on conflict do nothing;

  return query select created_group.id, created_group.invite_code;
end;
$$;

revoke all on function public.create_barkada_group(text, boolean) from public, anon;
grant execute on function public.create_barkada_group(text, boolean) to authenticated;
