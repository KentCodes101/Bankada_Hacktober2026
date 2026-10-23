-- PostgreSQL SUM(bigint) returns numeric. The browser RPC declares its
-- balance field as bigint, so make the receipt-ledger total explicit.
create or replace function public.list_my_group_savings()
returns table(
  group_id uuid,
  group_name text,
  role text,
  member_count bigint,
  savings_target_minor bigint,
  balance_minor bigint,
  currency text,
  receipt_count bigint,
  last_recorded_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.barkada_user_is_verified() then
    raise exception 'Verified email and completed profile are required.';
  end if;

  return query
  select
    g.id,
    g.name,
    gm.role,
    (select count(*) from public.group_members m where m.group_id = g.id),
    g.savings_target_minor,
    coalesce((
      select sum(case when r.direction = 'cash_in' then r.amount_minor else -r.amount_minor end)
      from public.group_receipt_transactions r
      where r.group_id = g.id
    ), 0)::bigint,
    g.savings_currency,
    (select count(*) from public.group_receipt_transactions r where r.group_id = g.id),
    (select max(r.created_at) from public.group_receipt_transactions r where r.group_id = g.id)
  from public.group_members gm
  join public.groups g on g.id = gm.group_id
  where gm.profile_id = auth.uid()
  order by g.name;
end;
$$;

revoke all on function public.list_my_group_savings() from public, anon;
grant execute on function public.list_my_group_savings() to authenticated;
