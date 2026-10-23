# Ticket 05 validation

Date: 2026-10-23 (Asia/Bangkok). Scope: [approved Ticket 05](../../.scratch/tonphueng-connect/issues/05-package-booking.md).

## Implemented behavior

Customer selects eligible package services, a start date and 1–100 participants, then reviews the persisted server total before explicitly confirming simulated payment. Prices use integer satang multiplied by participants. Admin sets duration to 1–30 days; legacy packages default to one day. The server derives the end date from the start date and duration. Future demo dates are accepted without claiming real availability or capacity checks.

Bookings retain package/service snapshots. Customer can reopen pending and confirmed bookings from My Trip; adding all booked places is a separate, paid-simulation-only action and does not modify manually saved places. Active Admin can view all bookings. No real payment provider, bank verification, AI, or feedback delivery is included.

## Local checks

Commands used Node 26 via `PATH=/Users/suphakorninsee/.local/bin:$PATH`:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | Passed: 6 files, 39 tests |
| `npm run test:e2e -- tests/bookings.spec.ts` | Passed: server-price review, committed response-loss retry with one booking, pending booking recovery, simulated confirmation, explicit My Trip addition, and Admin visibility |
| `npm run test:e2e -- tests/packages.spec.ts` | Passed: existing package browser regression |
| `npm run build` | Passed after final source corrections |
| `git diff --check` | Passed |

Browser tests use loopback HTTP doubles and block external HTTPS. They do not use real LINE accounts, Supabase credentials, or business records. Mobile screenshots are temporary local artifacts under `/tmp/tonphueng-booking-payment.png` and `/tmp/tonphueng-my-trip.png`.

## SQL and review evidence

Migration 006 and its RPCs ran in a temporary local PGlite database, with no project dependency added. Probes passed for derived price/end date, same-key replay after catalogue revision changes, rejection of changed payload under one key, stale revision, wrong/inactive service, past date and invalid participant count. Probes also covered cross-owner reads/mutations, repeated confirmation and My Trip addition, enabled RLS and denied anonymous table access. This validates SQL behavior in the local fixture; it does not establish real Supabase/PostgREST integration or concurrent production request behavior.

A fresh independent risk review found one P2: rotating the request UUID after an uncertain response could create a second booking. The correction retains the UUID for the same payload, freezes inputs during submission, and changes the key only for a changed payload. Manager inspected the final correction and browser regression proving a committed-but-failed-response retry leaves one booking. Manager also verified that My Trip no longer hides bookings that have not had places added. These conditions close the review finding; the independent review found no additional P1/P2 issue in SQL, authorization, snapshots, price, or transaction handling.

## Authorized Supabase migration (2026-10-23)

After owner authorization, preflight confirmed that both new tables and the create RPC were absent in project `xewzqzgghdyublpcikgt`. Migration 006 was applied from the reviewed file inside `BEGIN`/`COMMIT`. Postflight verified both tables, enabled RLS, denied browser table/RPC access and allowed service-role RPC access.

Real PostgreSQL probes used an existing active Customer and Staff Service inside a separate transaction. They checked 250,100-satang server pricing for two people, a two-day end date, repeated create, changed payload rejection, invalid participant count, stale catalogue revision, past date, wrong-owner confirmation denial, rejection of adding an unpaid booking, repeated confirmation/addition, and the original snapshot after a catalogue revision change. Every probe write, including temporary catalogue changes, was rolled back. Both new tables remained empty. Proof: `/tmp/tonphueng-migration006-verified.png`.

PostgREST read checks reached both new tables; invalid-owner create returned `42501`, and nonexistent confirm/add returned `P0002`, confirming the RPC schema is available without creating data. No Auth users, durable Bookings, trip places, or business fixtures were created.

## Remaining acceptance

The owner authorized commit/push and the existing Vercel Git integration handles deployment. Verify real Customer/LINE -> server-priced booking -> simulated confirmation -> Admin -> My Trip on the hosted release, including reopen and repeated requests. Real concurrent requests remain untested; local PGlite and sequential real SQL probes are not proof of production concurrency. No real payment was performed.
