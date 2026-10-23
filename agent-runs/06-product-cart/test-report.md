# Ticket 06 — Product and Cart validation

Migration `202610230007_products_cart.sql` was applied to the connected Supabase project on 2026-10-23 with owner authorization. Release is authorized. No external business data was seeded; hosted Customer/LINE acceptance remains pending.

## Local checks

- `npm test` — 7 files, 47 tests passed.
- `npm run test:e2e` — 14 browser tests passed, including Staff Product create/edit and one-photo enforcement, cross-owner denial, customer pickup/delivery totals, cart persistence after reload, explicit mixed-store confirmation, tampered client price/shipping rejection, archive disappearing after reload, and stale cart totals being withheld.
- `npm run typecheck` — passed.
- `npm run build` — passed on Next.js 16.4.2.
- A temporary PGlite probe at `/tmp/tonphueng-pglite/probe.mjs` applied migration 007 to a minimal local fixture of the existing account, service, and upload-session schema. It verified Product price storage in satang; a 2 × 12,550-satang delivery cart derived 25,100 subtotal + 5,000 shipping = 30,100 total despite a client-supplied price field; mixed-store save rejected (`P0001`); cross-owner Product edit rejected (`42501`); archived Product caused an unavailable cart with no totals; a two-photo Product upload session rejected (`22023`); and anonymous table/RPC privileges were denied while service-role privileges were present.

The PGlite fixture validates local SQL syntax and selected behavior only. It does not establish integration with the connected Supabase PostgreSQL/PostgREST instance, real Storage behavior, concurrent requests, or hosted Customer/LINE acceptance. Focused independent authorization/money/SQL review found no blocking issue; its Staff archive-list finding was corrected and the archive/reload browser regression passed. Manager verified that correction. Migration 007 is now applied; real SQL/PostgREST evidence is recorded below. No Order/payment flow is included; that remains Ticket 07.

## Visual evidence

Representative mobile and desktop screenshots for the filled Product editor and delivery cart are in `/tmp/tonphueng-product-cart/` for Manager inspection. The navigation is fixed; `.page-wrap` reserves 104px below content so the total and form actions can scroll above it.

## Authorized Supabase migration and probes — 2026-10-23

- Preflight confirmed new tables absent and the three upload constraints present; applied the unchanged migration inside a transaction.
- Verified RLS/browser-role denial/service-role SELECT on all three tables, and service-role-only security-definer RPCs with an empty search path.
- Real PostgreSQL RPC probes checked delivery 2 × 12,550 + 5,000 = 30,100 satang despite an injected price; pickup shipping 0; mixed-store, invalid owner, quantity 0 and empty delivery address rejection; exact-one-photo sessions; owner-bound one-use upload claims; archived-item cart withholding totals; and clear/read behavior.
- All fixture account/product/cart/upload-session writes and the temporary Service category adjustment were in one transaction and rolled back. Final durable counts: Products 0, carts 0, cart items 0. No Storage object was uploaded or deleted.
- PostgREST service-role SELECT returned 200 for all three tables; `read_customer_cart` rejected an invalid Customer with 403 / `42501`.
- Temporary evidence: `/tmp/tonphueng-migration007-verified.png` and `/tmp/tonphueng-migration007-probe.sql`. Real concurrent transactions, hosted Product photo upload and full Customer/LINE acceptance remain unverified. Ticket 07 was not started.
