-- Supabase installs pgcrypto in the `extensions` schema on this project.
create or replace function public.new_barkada_daily_code(p_code_date date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
  random_bytes bytea;
  byte_position integer;
begin
  loop
    candidate := '';
    random_bytes := extensions.gen_random_bytes(8);
    for byte_position in 0..7 loop
      candidate := candidate || chr(65 + (get_byte(random_bytes, byte_position) % 26));
    end loop;

    exit when not exists (
      select 1
      from public.groups as existing_group
      where existing_group.daily_join_code_date = p_code_date
        and existing_group.daily_join_code = candidate
    );
  end loop;
  return candidate;
end;
$$;

revoke all on function public.new_barkada_daily_code(date) from public, anon;
