-- The trigger runs during owner membership creation. Qualify every table
-- column: unqualified group_id/profile_id can conflict with PL/pgSQL record
-- fields on some Postgres configurations.
create or replace function public.enforce_barkada_membership_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member_total integer;
  group_total integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.group_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(new.profile_id::text, 0));

  if exists (
    select 1 from public.group_members as member_row
    where member_row.group_id = new.group_id and member_row.profile_id = new.profile_id
  ) then
    return new;
  end if;

  select count(*) into member_total
  from public.group_members as member_row
  where member_row.group_id = new.group_id;
  if member_total >= 10 then
    raise exception 'This group already has the maximum of 10 members.';
  end if;

  select count(*) into group_total
  from public.group_members as member_row
  where member_row.profile_id = new.profile_id;
  if group_total >= 5 then
    raise exception 'You can join up to 5 barkada groups.';
  end if;
  return new;
end;
$$;
