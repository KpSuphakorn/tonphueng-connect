# Ticket 04 local implementation report

**Status:** implementation complete; local review conditions resolved; awaiting live acceptance. Migration 005 is applied to the connected project; the PostgreSQL checks below passed. Hosted Admin/Customer workflow acceptance is pending.

## Behavior implemented

- Admin edits the three Package categories, descriptions/contact URL, Sub Packages, per-person demo price in integer satang, and typed slots with exact required counts and eligible active Services.
- Customer browses package details, selects the required choices, and persists/reloads them on the Sub Package details page. When the catalog changes, unavailable saved choices are discarded from the current selection so the Customer can choose replacements and save again.
- The server derives the saved price from the current catalog and rejects forged prices, invalid categories/Services/counts, stale revisions, unauthenticated or non-Customer writes, and non-Admin catalog writes.
- This is saved selection data, not a Booking or payment. The demo formula is the Admin-entered per-person amount; participant multiplication and payment are outside this ticket.

## Local validation

- `npm test -- --reporter=dot`: 36 tests passed across 5 files, including package API boundary tests.
- `npm run typecheck`: passed.
- `npm run build`: passed with Next.js 16.4.2.
- `npm run test:e2e -- --reporter=line`: 12 browser tests passed. The package flow covers Admin configuration, Customer save/reload, Admin replacing an eligible Service, replacement of the now-stale Customer choice, server rejection of an invalid count, and signed-in Customer homepage copy.
- Browser and HTTP checks use loopback fake Supabase services; external HTTPS requests are blocked in Playwright. No real database mutation or LINE request was made.

## Acceptance still pending

- PostgreSQL migration/grants/RLS/RPC checks are complete; verify the actual hosted Admin and Customer workflows with owner-controlled accounts.
- Perform live Admin catalog save and Customer selection/reload against the connected app after migration and deployment.
- Confirm business-approved package wording, contact URL, and demo prices before presenting them as real offers.

## Review closure

One independent risk review passed Standards and found no blocking pricing, authorization, or catalogue atomicity issue. Its single Spec finding was stale saved Service IDs blocking replacement choices. The correction filters restored choices against current eligible options and caps the required count. Manager inspected that delta; the browser regression now passes saved A → Admin replaces A with B → Customer selects and saves B. The review's local approval condition is met; PostgreSQL and hosted acceptance remain pending.

## Migration 005 — 23 Oct 2026

Applied with owner authorization in the intended Supabase project `xewzqzgghdyublpcikgt`. PostgreSQL exposed two SQL-only defects that HTTP doubles cannot detect: reserved variable `current_catalog`, and an unqualified account `id` conflicting with the selection RPC OUT parameter. Renamed the variable and qualified the account columns without changing business rules. The failed first DDL transaction and failed probe transaction were rolled back; the corrected functions were installed successfully.

Verified both tables have RLS, browser roles have no table/RPC access, and service role can execute both RPCs. Actual PostgreSQL probes passed catalogue insert/update/revision conflict; rejected non-active Customer, stale selection revision, wrong slot count, unlisted Service, and missing Service; and verified server-derived price and stable upsert ID. The positive SQL-only price/upsert fixture used zero slots solely to reach the write branch without creating Staff/Auth identities; it is not acceptance of a normal UI-configured package or active-Service happy path. Every probe was enclosed in a transaction and rolled back. No durable demo catalogue, Customer selection, Auth identity, or photo was seeded. Proof: `/tmp/tonphueng-migration005-verified.png`.

Existing local application checks remain applicable to the unchanged application code; the SQL-only identifier corrections were validated on PostgreSQL. Real Admin configuration and Customer selection with active Staff Services still require hosted acceptance.
