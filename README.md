# Bankada

Bankada is a receipt-backed group-savings tracker. It does **not** connect to bank/e-wallet accounts, read external activity, or transfer money. A group balance changes only when a current member uploads a complete transaction screenshot for a cash-in or withdrawal.

Each recorded transaction stores:

- the original private screenshot;
- OCR.space’s extracted text as a private `.txt` file;
- OCR-derived amount and reference when readable;
- the member-selected payment method (GoTyme, Maya, GCash, or any other bank/e-wallet);
- the direction, submitting member, and recording time.

Only current members of that group can view the history, screenshot, or OCR text. Receipt transactions are append-only; corrections require a new receipt-backed entry.

## Local development

```bash
npm install
npm.cmd run dev
```

Create `.env` for browser authentication only:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

The default authenticated view is the responsive receipt ledger dashboard. It shows the group balance, goal progress, member contribution chart, and recent receipt activity using the receipt-backed group-savings RPCs. Select **Manage group** to open group setup, receipt recording, history, and trip-planning tools.

## Deploy receipt-backed savings

Apply the Supabase migrations in order, including [`20261022040000_group_savings_receipts.sql`](./supabase/migrations/20261022040000_group_savings_receipts.sql), then deploy the edge functions:

```bash
supabase db push
supabase functions deploy receipt-ocr
```

Set these secrets in Supabase. Never put any of them in a Vite environment file or repository:

```text
OCR_SPACE_API_KEY=<your OCR.space API key>
APP_ORIGIN=https://your-bankada-app.example
```

The `receipt-ocr` function verifies the authenticated member, accepts only PNG/JPG/WebP screenshots under 8 MB, sends the screenshot to OCR.space over HTTPS, stores the OCR text in the private `group-receipts` bucket, and appends the transaction only after OCR identifies a positive amount. The original screenshot and text file are protected by group-member storage policies.

OCR is extraction, not proof of payment. Members should review every receipt, and the product must clearly disclose that receipt screenshots are sent to OCR.space. OCR.space documents file upload/base64 OCR requests and returns parsed text in JSON. [OCR.space API documentation](https://ocr.space/ocrapi)

## Group limits and deletion

Users can be members of up to five groups; groups can have up to ten members. Members join with a daily eight-letter code. The owner may schedule a group for deletion; all current members receive an in-app Bankada notification and the deletion becomes eligible after three days. Configure a Supabase Cron **Database function** job to run `public.finalize_due_barkada_group_deletions` every 15 minutes so finalisation does not depend on anyone visiting the app. The owner may cancel while the three-day window is still open.
