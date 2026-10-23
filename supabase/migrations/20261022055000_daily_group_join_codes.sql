-- A daily code is shared by existing members.  Codes are rotated using the
-- Philippine calendar, so they expire at 12:00 AM Asia/Manila.
alter table public.groups
  add column if not exists daily_join_code text,
  add column if not exists daily_join_code_date date;

create unique index if not exists groups_daily_join_code_unique
  on public.groups (daily_join_code_date, daily_join_code)
  where daily_join_code is not null;

create or replace function public.barkada_philippine_date()
returns date
language sql
stable
set search_path = public
as $$ select (now() at time zone 'Asia/Manila')::date $$;

create or replace function public.new_barkada_daily_code(p_code_date date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare candidate text;
begin
  loop
    select string_agg(chr(65 + (get_byte(random_bytes, position) % 26)), '' order by position)
      into candidate
    from (select gen_random_bytes(8) as random_bytes) as bytes,
         generate_series(0, 7) as position;

    exit when not exists (
      select 1 from public.groups as existing_group
      where existing_group.daily_join_code_date = p_code_date
        and existing_group.daily_join_code = candidate
    );
  end loop;
  return candidate;
end;
$$;

create or replace function public.refresh_barkada_daily_join_codes()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare today_ph date := public.barkada_philippine_date(); group_row record;
begin
  -- Serialising rotation avoids a duplicate code if two users arrive at midnight.
  perform pg_advisory_xact_lock(hashtext('bankada-daily-group-codes'));
  for group_row in
    select id from public.groups
    where daily_join_code_date is distinct from today_ph
       or daily_join_code is null
    for update
  loop
    update public.groups
    set daily_join_code_date = today_ph,
        daily_join_code = public.new_barkada_daily_code(today_ph)
    where id = group_row.id;
  end loop;
end;
$$;

create or replace function public.get_barkada_daily_join_code(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.barkada_user_is_verified() or not exists (
    select 1 from public.group_members as member_row
    where member_row.group_id = p_group_id and member_row.profile_id = auth.uid()
  ) then
    raise exception 'Only group members can view this group code.';
  end if;

  perform public.refresh_barkada_daily_join_codes();
  return (select daily_join_code from public.groups where id = p_group_id);
end;
$$;

create or replace function public.join_barkada_by_daily_code(p_code text)
returns table(group_id uuid, group_name text)
language plpgsql
security definer
set search_path = public
as $$
declare normalized_code text := upper(trim(coalesce(p_code, ''))); target_group public.groups%rowtype;
begin
  if not public.barkada_user_is_verified() then
    raise exception 'Verified email and completed profile are required.';
  end if;
  if normalized_code !~ '^[A-Z]{8}$' then
    raise exception 'Enter the eight-letter group code.';
  end if;

  perform public.refresh_barkada_daily_join_codes();
  select * into target_group from public.groups as group_row
  where group_row.daily_join_code_date = public.barkada_philippine_date()
    and group_row.daily_join_code = normalized_code;
  if target_group.id is null then
    raise exception 'That group code is invalid or has expired.';
  end if;
  if exists (
    select 1 from public.group_members as member_row
    where member_row.group_id = target_group.id and member_row.profile_id = auth.uid()
  ) then
    raise exception 'You already belong to this group.';
  end if;

  insert into public.group_members (group_id, profile_id, role)
  values (target_group.id, auth.uid(), 'member');
  return query select target_group.id, target_group.name;
end;
$$;

-- Email invitations and public discovery are retired in favour of daily codes.
revoke all on function public.search_public_barkadas(text), public.request_to_join_barkada(uuid), public.create_group_email_invitation(uuid, text, uuid), public.confirm_group_email_invitation(text, text) from authenticated;
revoke all on function public.get_barkada_daily_join_code(uuid), public.join_barkada_by_daily_code(text), public.barkada_philippine_date(), public.new_barkada_daily_code(date), public.refresh_barkada_daily_join_codes() from public, anon;
grant execute on function public.get_barkada_daily_join_code(uuid), public.join_barkada_by_daily_code(text) to authenticated;
