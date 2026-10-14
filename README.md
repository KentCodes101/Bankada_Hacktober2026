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

## GoTyme transfer sandbox

The **Transfers** tab now contains a GoTyme storage-transfer experience. It is deliberately a local-only sandbox: it makes no network request, does not change any wallet or bank balance, and uses `DBG-*` identifiers rather than pretending to issue GoTyme trace IDs or reference numbers. Receipts are held only in React memory for the active page session and display masked account identifiers.

Before enabling real transfers, implement these controls on the server (not in this client):

- Authenticate every request and use database row-level security so only the transfer owner and explicitly authorized support roles can read a receipt.
- Keep the GoTyme destination account in server configuration or a restricted database table; never accept it from the browser and never expose a mutation endpoint to ordinary users.
- Create a pending transfer with an idempotency key, then call an approved GoTyme/payment-partner API from a secrets-managed server environment. Verify signed provider webhooks before marking a transfer successful.
- Persist only provider-returned trace/reference numbers, use an append-only audit ledger, encrypt sensitive values at rest, and redact account numbers from application logs.
- Enforce authorization, step-up authentication, rate limits, velocity limits, amount limits, reconciliation, monitoring, and a failure/reversal workflow before funds are made available.

## Debug withdrawals, consent, and multi-rail routing

The app is currently **locked in Debug Mode**. Its Send Cash flow exposes simulated routing choices for GoTyme, Maya, and GCash, while Withdrawals demonstrates a five-member unanimous-consent workflow. The simulated consent button exists only to exercise the interface; it is not an approval mechanism and cannot release funds. All receipts, provider-like IDs, history entries, and unidentified-withdrawal alerts are session-only demonstrations.

The History screen contains a simulated hash per event to make the audit-trail UX testable. This is **not a blockchain** and cannot provide immutability from a browser. Do not put account numbers, personal information, provider secrets, or receipts on a public blockchain. A production system should instead use an append-only server ledger (hash-linked, encrypted, access controlled, and regularly reconciled) and, only if a genuine compliance need exists, anchor a digest of a batch to a permissioned ledger under legal/security review.

For live GoTyme, Maya, or GCash support, Bankada needs written commercial/API access for each provider. The server should normalize those provider APIs behind one connector interface; store credentials in a secrets manager; use per-provider idempotency keys and destination verification; verify signed webhooks; independently reconcile source-account transactions; and create a high-severity incident when an observed withdrawal has no matching Bankada authorization. The incident must notify all group members with masked fields, freeze further releases where appropriate, preserve the raw event securely, and escalate to provider support and the group according to the approved incident policy.

## Build quality checklist

Documentation (30%), technical soundness (60%), and infrastructure/deployment (10%) are reflected in the project structure and roadmap. Before production: add unit/component tests, Supabase migrations and RLS policies, CI, error monitoring, accessibility checks, and App Store/Play Store release configuration.
