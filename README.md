# Bankada

Bankada is a mobile-first group money manager for shared sinking funds, receipt capture, collaborative withdrawal approvals, and budget-aware trip planning.

## Product direction

- Cross-platform mobile delivery: Expo/React Native can consume this TypeScript UI and ship to iPhone and Android.
- Online sync: use Supabase Auth, Postgres, Row Level Security, and Realtime for group membership and shared balances.
- Receipt intelligence: keep OpenAI API keys server-side and send receipt images through a protected edge function for structured extraction.
- Safe withdrawals: use an immutable approval ledger, threshold rules, and idempotent transaction records.
- Trip planning: calculate options from available fund balance, target dates, and per-member contribution capacity.

## Local development

```bash
npm install
npm run dev
```

The current slice is a responsive product prototype with working tab navigation, approval interaction, receipt-scan action, and mobile layout. Production integrations should be added through an API boundary rather than exposing secrets in the client.

## Build quality checklist

Documentation (30%), technical soundness (60%), and infrastructure/deployment (10%) are reflected in the project structure and roadmap. Before production: add unit/component tests, Supabase migrations and RLS policies, CI, error monitoring, accessibility checks, and App Store/Play Store release configuration.
