# Trip planner chat (Supabase Edge Function)

`supabase/functions/chat/index.ts` serves `POST {SUPABASE_URL}/functions/v1/chat`. The Vite app calls it from `src/TripPlanner.tsx` with the signed-in user's access token (`Authorization: Bearer <JWT>`).

## Secrets

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected by Supabase automatically. Set the rest (never prefix the OpenAI key with `VITE_`):

```bash
supabase secrets set OPENAI_API_KEY=your-secret-key
supabase secrets set OPENAI_MODEL=gpt-4o-mini        # optional
supabase secrets set TRIP_FUND_ID=local-development-fund-uuid   # optional fallback fundId
```

## Deploy

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase functions deploy chat
```

JWT verification stays enabled (the default), so unauthenticated callers are rejected by Supabase before the function runs. The function also rejects users whose email or phone confirmation is incomplete.

## Behaviour

The request body permits only `messages` and `fundId`; if `fundId` is omitted the function uses the `TRIP_FUND_ID` secret. The function verifies the user's session, loads `funds.goal_name` and `funds.target_amount` through the caller's RLS-scoped client, and explicitly checks `group_members.profile_id` against the fund's `group_id` before contacting OpenAI. Ensure those column names match your migrations and keep row-level security enabled on both tables.

`target_amount` is treated as major currency units and converted to minor units for itinerary arithmetic. If the database stores minor units, adjust that conversion.
