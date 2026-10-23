create or replace function public.barkada_user_is_verified()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and length(trim(coalesce(nullif(u.email, ''), u.raw_user_meta_data ->> 'email_address', ''))) > 0
      and length(trim(coalesce(nullif(u.phone, ''), u.raw_user_meta_data ->> 'phone_number', ''))) > 0
      and (
        (u.email is not null and u.email_confirmed_at is not null)
        or (u.phone is not null and u.phone_confirmed_at is not null)
      )
      and length(trim(coalesce(u.raw_user_meta_data ->> 'full_name', ''))) > 0
      and length(trim(coalesce(u.raw_user_meta_data ->> 'avatar_emoji', ''))) > 0
  );
$$;
