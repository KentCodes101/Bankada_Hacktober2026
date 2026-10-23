-- Receipt-backed group savings. Bankada never connects to, reads, or moves
-- money in a bank/e-wallet account. A member-submitted receipt is the sole
-- basis for recording a cash-in or withdrawal.
create extension if not exists pgcrypto;

alter table public.groups
  add column if not exists savings_target_minor bigint not null default 0 check (savings_target_minor >= 0),
  add column if not exists savings_currency text not null default 'PHP' check (savings_currency = 'PHP');

create or replace function public.enforce_barkada_membership_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare member_total integer; group_total integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.group_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(new.profile_id::text, 0));
  if exists (select 1 from public.group_members where group_id = new.group_id and profile_id = new.profile_id) then return new; end if;
  select count(*) into member_total from public.group_members where group_id = new.group_id;
  if member_total >= 10 then raise exception 'This group already has the maximum of 10 members.'; end if;
  select count(*) into group_total from public.group_members where profile_id = new.profile_id;
  if group_total >= 5 then raise exception 'You can join up to 5 barkada groups.'; end if;
  return new;
end;
$$;
drop trigger if exists enforce_barkada_membership_limits on public.group_members;
create trigger enforce_barkada_membership_limits before insert on public.group_members for each row execute function public.enforce_barkada_membership_limits();

create table if not exists public.group_email_invitations (
  id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups(id) on delete cascade,
  invited_email text not null check (invited_email = lower(trim(invited_email))), token_hash text not null unique, code_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'delivery_failed', 'accepted', 'revoked', 'expired')),
  failed_code_attempts smallint not null default 0 check (failed_code_attempts >= 0), expires_at timestamptz not null,
  sent_by uuid not null references auth.users(id) on delete cascade, sent_at timestamptz, accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
create index if not exists group_email_invitations_group_idx on public.group_email_invitations (group_id, status, created_at desc);

create table if not exists public.group_receipt_transactions (
  id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups(id) on delete cascade,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  direction text not null check (direction in ('cash_in', 'withdrawal')),
  amount_minor bigint not null check (amount_minor > 0), currency text not null default 'PHP' check (currency = 'PHP'),
  payment_method text not null check (length(trim(payment_method)) between 2 and 100),
  transaction_reference text check (length(transaction_reference) <= 160), occurred_at timestamptz not null,
  receipt_image_path text not null unique, receipt_text_path text not null unique, receipt_sha256 text not null unique,
  ocr_text text not null check (length(ocr_text) > 0 and length(ocr_text) <= 50000),
  created_at timestamptz not null default now()
);
create index if not exists group_receipt_transactions_group_time_idx on public.group_receipt_transactions (group_id, occurred_at desc, id desc);

-- Records are append-only. A correction is a separate receipt-backed entry.
create or replace function public.reject_group_receipt_transaction_mutation()
returns trigger language plpgsql set search_path = public as $$ begin raise exception 'Receipt transactions are append-only; add a correcting receipt instead.'; end; $$;
drop trigger if exists reject_group_receipt_transaction_update on public.group_receipt_transactions;
create trigger reject_group_receipt_transaction_update before update or delete on public.group_receipt_transactions for each row execute function public.reject_group_receipt_transaction_mutation();

alter table public.group_email_invitations enable row level security;
alter table public.group_receipt_transactions enable row level security;
revoke all on public.group_email_invitations, public.group_receipt_transactions from anon, authenticated;
create policy "Members can read group receipt transactions" on public.group_receipt_transactions for select to authenticated using (
  public.barkada_user_is_verified() and exists (select 1 from public.group_members gm where gm.group_id = group_receipt_transactions.group_id and gm.profile_id = auth.uid())
);
grant select on public.group_receipt_transactions to authenticated;

-- Private storage for original screenshots and the OCR text files. The first
-- folder segment is the group id; the second is the submitting user id.
insert into storage.buckets (id, name, public) values ('group-receipts', 'group-receipts', false) on conflict (id) do update set public = false;
drop policy if exists "Group members can read receipt objects" on storage.objects;
create policy "Group members can read receipt objects" on storage.objects for select to authenticated using (
  bucket_id = 'group-receipts' and public.barkada_user_is_verified() and exists (
    select 1 from public.group_members gm where gm.profile_id = auth.uid() and gm.group_id::text = (storage.foldername(name))[1]
  )
);
drop policy if exists "Members can upload own receipt images" on storage.objects;
create policy "Members can upload own receipt images" on storage.objects for insert to authenticated with check (
  bucket_id = 'group-receipts' and public.barkada_user_is_verified() and (storage.foldername(name))[2] = auth.uid()::text and exists (
    select 1 from public.group_members gm where gm.profile_id = auth.uid() and gm.group_id::text = (storage.foldername(name))[1]
  )
);

create or replace function public.update_group_savings_target(p_group_id uuid, p_target_minor bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.barkada_user_is_verified() then raise exception 'Verified email and completed profile are required.'; end if;
  if p_target_minor is null or p_target_minor < 0 then raise exception 'Savings target must be zero or greater.'; end if;
  if not exists (select 1 from public.group_members where group_id = p_group_id and profile_id = auth.uid() and role in ('owner', 'admin')) then raise exception 'Only group owners and admins can update the savings target.'; end if;
  update public.groups set savings_target_minor = p_target_minor where id = p_group_id;
end;
$$;

create or replace function public.list_my_group_savings()
returns table(group_id uuid, group_name text, role text, member_count bigint, savings_target_minor bigint, balance_minor bigint, currency text, receipt_count bigint, last_recorded_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.barkada_user_is_verified() then raise exception 'Verified email and completed profile are required.'; end if;
  return query select g.id, g.name, gm.role, (select count(*) from public.group_members m where m.group_id = g.id), g.savings_target_minor,
    coalesce((select sum(case when r.direction = 'cash_in' then r.amount_minor else -r.amount_minor end) from public.group_receipt_transactions r where r.group_id = g.id), 0),
    g.savings_currency, (select count(*) from public.group_receipt_transactions r where r.group_id = g.id),
    (select max(r.created_at) from public.group_receipt_transactions r where r.group_id = g.id)
  from public.group_members gm join public.groups g on g.id = gm.group_id where gm.profile_id = auth.uid() order by g.name;
end;
$$;

create or replace function public.list_group_receipt_history(p_group_id uuid, p_limit integer default 100)
returns table(transaction_id uuid, direction text, amount_minor bigint, payment_method text, transaction_reference text, occurred_at timestamptz, submitted_by_name text, receipt_image_path text, receipt_text_path text, ocr_text text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.barkada_user_is_verified() or not exists (select 1 from public.group_members where group_id = p_group_id and profile_id = auth.uid()) then raise exception 'Only group members can view this transaction history.'; end if;
  return query select r.id, r.direction, r.amount_minor, r.payment_method, r.transaction_reference, r.occurred_at,
    coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), 'Bankada member'), r.receipt_image_path, r.receipt_text_path, r.ocr_text
  from public.group_receipt_transactions r join auth.users u on u.id = r.submitted_by where r.group_id = p_group_id
  order by r.occurred_at desc, r.id desc limit greatest(1, least(coalesce(p_limit, 100), 200));
end;
$$;

-- This RPC is service-role only; receipt-ocr authenticates the caller and
-- validates group membership before calling it.
create or replace function public.record_group_receipt_transaction(p_group_id uuid, p_submitted_by uuid, p_direction text, p_amount_minor bigint, p_payment_method text, p_transaction_reference text, p_occurred_at timestamptz, p_receipt_image_path text, p_receipt_text_path text, p_receipt_sha256 text, p_ocr_text text)
returns uuid language plpgsql security definer set search_path = public as $$
declare transaction_id uuid;
begin
  if not exists (select 1 from public.group_members where group_id = p_group_id and profile_id = p_submitted_by) then raise exception 'Only group members can submit receipts.'; end if;
  if p_direction not in ('cash_in', 'withdrawal') or p_amount_minor is null or p_amount_minor <= 0 then raise exception 'Receipt transaction has invalid cash-change details.'; end if;
  if length(trim(coalesce(p_payment_method, ''))) not between 2 and 100 or p_occurred_at is null or length(coalesce(p_ocr_text, '')) not between 1 and 50000 then raise exception 'Receipt data is incomplete.'; end if;
  insert into public.group_receipt_transactions (group_id, submitted_by, direction, amount_minor, payment_method, transaction_reference, occurred_at, receipt_image_path, receipt_text_path, receipt_sha256, ocr_text)
  values (p_group_id, p_submitted_by, p_direction, p_amount_minor, trim(p_payment_method), nullif(trim(coalesce(p_transaction_reference, '')), ''), p_occurred_at, p_receipt_image_path, p_receipt_text_path, p_receipt_sha256, p_ocr_text)
  returning id into transaction_id;
  return transaction_id;
end;
$$;

create or replace function public.list_barkada_members(p_group_id uuid)
returns table(profile_id uuid, display_name text, avatar_emoji text, role text, joined_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.barkada_user_is_verified() or not exists (select 1 from public.group_members where group_id = p_group_id and profile_id = auth.uid()) then raise exception 'Only group members can view this group.'; end if;
  return query select gm.profile_id, coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), 'Bankada member'), coalesce(u.raw_user_meta_data ->> 'avatar_emoji', ''), gm.role, gm.joined_at from public.group_members gm join auth.users u on u.id = gm.profile_id where gm.group_id = p_group_id order by case gm.role when 'owner' then 0 when 'admin' then 1 else 2 end, gm.joined_at;
end;
$$;

create or replace function public.create_group_email_invitation(p_group_id uuid, p_invited_email text, p_invited_by uuid)
returns table(invitation_id uuid, invite_token text, invite_code text, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare normalized_email text := lower(trim(coalesce(p_invited_email, ''))); raw_token text := encode(gen_random_bytes(32), 'hex'); raw_code text := lpad((((get_byte(gen_random_bytes(3), 0) * 65536) + (get_byte(gen_random_bytes(3), 1) * 256) + get_byte(gen_random_bytes(3), 2)) % 1000000)::text, 6, '0'); new_invitation public.group_email_invitations%rowtype; current_members integer; pending_invites integer;
begin
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid invitee email address.'; end if;
  if not exists (select 1 from public.group_members where group_id = p_group_id and profile_id = p_invited_by and role in ('owner', 'admin')) then raise exception 'Only group owners and admins can invite members.'; end if;
  select count(*) into current_members from public.group_members where group_id = p_group_id;
  select count(*) into pending_invites from public.group_email_invitations where group_id = p_group_id and status in ('pending', 'delivery_failed') and expires_at > now();
  if current_members + pending_invites >= 10 then raise exception 'This group has no remaining invitation slots (maximum 10 members).'; end if;
  update public.group_email_invitations set status = 'revoked' where group_id = p_group_id and invited_email = normalized_email and status in ('pending', 'delivery_failed');
  insert into public.group_email_invitations (group_id, invited_email, token_hash, code_hash, expires_at, sent_by) values (p_group_id, normalized_email, encode(digest(raw_token, 'sha256'), 'hex'), crypt(raw_code, gen_salt('bf', 12)), now() + interval '24 hours', p_invited_by) returning * into new_invitation;
  return query select new_invitation.id, raw_token, raw_code, new_invitation.expires_at;
end;
$$;

create or replace function public.confirm_group_email_invitation(p_invite_token text, p_code text)
returns table(group_id uuid, group_name text) language plpgsql security definer set search_path = public as $$
declare invitation public.group_email_invitations%rowtype; current_email text;
begin
  if not public.barkada_user_is_verified() then raise exception 'Verified email and completed profile are required.'; end if;
  if coalesce(p_invite_token, '') !~ '^[a-f0-9]{64}$' or coalesce(p_code, '') !~ '^[0-9]{6}$' then raise exception 'The invitation link or six-digit code is invalid.'; end if;
  select lower(email) into current_email from auth.users where id = auth.uid(); select * into invitation from public.group_email_invitations where token_hash = encode(digest(p_invite_token, 'sha256'), 'hex') for update;
  if invitation.id is null then raise exception 'This invitation was not found.'; end if;
  if invitation.status not in ('pending', 'delivery_failed') or invitation.expires_at <= now() then update public.group_email_invitations set status = 'expired' where id = invitation.id and status in ('pending', 'delivery_failed'); raise exception 'This invitation has expired or is no longer active.'; end if;
  if invitation.invited_email <> current_email then raise exception 'Sign in with the email address that received this invitation.'; end if;
  if invitation.failed_code_attempts >= 5 then update public.group_email_invitations set status = 'expired' where id = invitation.id; raise exception 'Too many incorrect codes. Ask for a new invitation.'; end if;
  if invitation.code_hash <> crypt(p_code, invitation.code_hash) then update public.group_email_invitations set failed_code_attempts = failed_code_attempts + 1 where id = invitation.id; raise exception 'That six-digit invitation code is incorrect.'; end if;
  insert into public.group_members (group_id, profile_id, role) values (invitation.group_id, auth.uid(), 'member') on conflict (group_id, profile_id) do nothing;
  update public.group_email_invitations set status = 'accepted', accepted_at = now(), accepted_by = auth.uid() where id = invitation.id;
  return query select g.id, g.name from public.groups g where g.id = invitation.group_id;
end;
$$;

revoke all on function public.update_group_savings_target(uuid, bigint), public.list_my_group_savings(), public.list_group_receipt_history(uuid, integer), public.list_barkada_members(uuid), public.create_group_email_invitation(uuid, text, uuid), public.confirm_group_email_invitation(text, text), public.record_group_receipt_transaction(uuid, uuid, text, bigint, text, text, timestamptz, text, text, text, text) from public, anon, authenticated;
grant execute on function public.update_group_savings_target(uuid, bigint), public.list_my_group_savings(), public.list_group_receipt_history(uuid, integer), public.list_barkada_members(uuid), public.confirm_group_email_invitation(text, text) to authenticated;
