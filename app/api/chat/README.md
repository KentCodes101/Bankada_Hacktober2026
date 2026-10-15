# Trip planner chat route

This route is for the Next.js App Router. The repository's current prototype still runs on Vite, so it needs the planned Next.js migration plus `next`, `@supabase/ssr`, and `@supabase/supabase-js` dependencies before `/api/chat` is served by the app.

## Server environment

Configure these on the Next.js server (never prefix the OpenAI key with `VITE_`):

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
OPENAI_API_KEY=your-secret-key
OPENAI_MODEL=gpt-4o-mini
VITE_TRIP_FUND_ID=local-development-fund-uuid
```

The request body permits only `messages` and `fundId`; if `fundId` is omitted, the server uses `VITE_TRIP_FUND_ID`. The route verifies the Supabase session, loads `funds.goal_name` and `funds.target_amount` server-side, and explicitly checks `group_members.profile_id` against the fund's `group_id` before contacting OpenAI. Ensure those column names match the production migrations and preserve row-level security on both tables.

The implementation treats `target_amount` as major currency units and converts it to minor units for itinerary arithmetic. If the database stores amounts in minor units, adjust that conversion and document the schema convention in the migration.
