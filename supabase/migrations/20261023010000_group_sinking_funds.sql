create table if not exists public.funds (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  goal_name text not null check (char_length(btrim(goal_name)) between 1 and 80),
  target_amount numeric(14, 2) not null check (target_amount > 0),
  currency text not null default 'PHP',
  created_at timestamptz not null default now()
);

alter table public.funds add column if not exists created_at timestamptz not null default now();
alter table public.funds enable row level security;
grant select, insert on public.funds to authenticated;

drop policy if exists "Group members can read sinking fund goals" on public.funds;
create policy "Group members can read sinking fund goals"
  on public.funds for select to authenticated
  using (exists (
    select 1 from public.group_members member
    where member.group_id = funds.group_id and member.profile_id = auth.uid()
  ));

drop policy if exists "Group members can create sinking fund goals" on public.funds;
create policy "Group members can create sinking fund goals"
  on public.funds for insert to authenticated
  with check (exists (
    select 1 from public.group_members member
    where member.group_id = funds.group_id and member.profile_id = auth.uid()
  ));

create index if not exists funds_group_created_idx on public.funds(group_id, created_at desc);
