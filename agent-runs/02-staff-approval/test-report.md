# Ticket 02 local validation

Implementation validation completed locally on 2026-10-22. Migration 002 was later applied manually to the intended Supabase project in a transaction and verified; no live Auth signup, Storage upload, LINE, or hosting requests were made.

## Final results

- `PATH=/Users/suphakorninsee/.local/bin:$PATH npm test` — passed, 2 files and 21 tests. Auth, REST, and Storage boundaries use HTTP doubles.
- `PATH=/Users/suphakorninsee/.local/bin:$PATH npm run typecheck` — passed.
- `STAFF_APPROVAL_SCREENSHOT_DIR=/tmp PATH=/Users/suphakorninsee/.local/bin:$PATH npm run test:e2e` — passed, 4 browser tests. The Ticket 02 flow used a local fake Supabase HTTP server and a seeded Admin application session; registration, pending access denial, Admin review/approval, Staff login, edit, and persisted reload were observed in the browser.
- `PATH=/Users/suphakorninsee/.local/bin:$PATH npm run build` — passed with Next.js 16.4.2.
- `git diff --check` — passed.
- Refreshed mobile screenshots: `/tmp/tonphueng-staff-register-mobile.png` and `/tmp/tonphueng-admin-approval-mobile.png`.

## Limits

These checks demonstrate application behavior against local HTTP doubles, not a real Supabase project. Migration `202610220002_staff_approval.sql` is applied to `tonphueng-connect`; its table, RLS/grants, private photo bucket, and approval function were verified through the SQL Editor. Live Auth/Storage integration and owner-controlled acceptance remain pending. The test doubles do not replace product login or alter Ticket 01 behavior.

## Review corrections and revalidation

The independent review identified request-size, compensation, required-photo, Admin email, and ambiguous-write cases. Actual streamed multipart bytes are capped at 27 MiB on both Staff endpoints; the server reports recoverable cleanup failures when Storage/Auth returns errors; registration requires at least one decoded photo; the Admin application card displays the Auth-stored email; and replacement images are preserved after any unsuccessful or thrown profile PATCH result. A registration Service INSERT with an uncertain result also preserves the pending Auth/account/photos for Admin inspection rather than compensating a possible committed profile. Tests simulate a database commit followed by a 502 for both profile update and registration. Partial upload cleanup includes the attempted object's path as well as prior successful paths. Setup guidance requires inspecting Auth, account, Service, and object references before cleanup; active accounts and complete Service profiles must be preserved.

The final test command above covers the former 16-test baseline plus these review regressions (21 tests total). The HTTP doubles do not provide real PostgreSQL or Storage acceptance.

These remain local HTTP-double and build checks. They do not establish live Auth/Storage behavior or owner acceptance. If cleanup cannot finish during a service outage, the result is deliberately reported as requiring manual Admin recovery, not guaranteed rollback.

## Final independent review

The fresh targeted review passed both Standards and Spec, with no blocking findings. The previously identified write-outcome issues are resolved. At review time no remote migration or live acceptance had been performed; migration 002 was subsequently applied and its schema/security settings verified. Live Auth/Storage acceptance remains outstanding. The original Ticket 02 implementation was subsequently committed as `aec0c9c`; it has not been pushed. Ticket 03 and the Vercel upload adaptation remain uncommitted and unpushed.

## Supabase migration 002

Applied to the `tonphueng-connect` project in the Supabase SQL Editor on 2026-10-22, wrapped in `BEGIN`/`COMMIT`. The preflight showed no existing `services` table, photo bucket, or approval function. Postflight verified `services` exists with RLS enabled; `anon` and `authenticated` have no table SELECT; `staff-business-photos` is private with a 5 MiB file limit; `approve_staff_account(uuid)` exists and `anon` cannot execute it. No accounts or photo objects were created. Live Auth/Storage flow acceptance is still pending HTTPS hosting and LIFF setup.

## Vercel direct-upload adaptation (2026-10-23)

The former multipart image path is replaced locally. The browser obtains an opaque one-use session and server-generated per-object signed upload URLs, then sends the binary directly to private Supabase staging. Registration/profile Vercel requests carry only bounded form fields and the capability (64 KiB streamed request cap). The server claims the exact manifest atomically, reads staged objects in bounded streams, enforces actual per-file/combined bytes and decoded image constraints, normalizes to WebP, and writes only to the existing private canonical bucket. Existing registration compensation and ambiguous Service INSERT/PATCH behavior remain covered. The previous 27 MiB multipart limit recorded above describes the earlier implementation; it is superseded by the current direct-upload flow.

Validation after this adaptation:

- `PATH=/Users/suphakorninsee/.local/bin:$PATH npm test` — passed, 4 files and 33 tests. HTTP doubles cover generated path manifests, profile-session authentication/owner binding, one-use replay behavior, invalid/oversized image bytes, bounded staged stream reads, cleanup errors, and failure to persist signed-token expiry.
- `PATH=/Users/suphakorninsee/.local/bin:$PATH npm run test:e2e` — passed, 4 browser tests. The existing fake Supabase server handles signed binary PUTs; browser registration and profile photo replacement complete, while the registration request body remains below 64 KiB. No mock sign-in was added.
- `PATH=/Users/suphakorninsee/.local/bin:$PATH npm run typecheck` — passed.
- `PATH=/Users/suphakorninsee/.local/bin:$PATH npm run build` — passed with Next.js 16.4.2.
- `git diff --check` — passed; the generated `next-env.d.ts` churn was restored.

Migration `202610230004_staff_photo_uploads.sql` was subsequently applied with owner authorization (see below); migrations 001–004 are now applied to the connected project. No live Storage upload, Auth signup, LINE login, durable seed, or deployment was performed. The session table keeps hashed capabilities and exact server-owned paths, with separate two-hour app expiry and signed-token cleanup expiry plus a five-minute margin. Expired staging cleanup removes at most 10 sessions when another upload is prepared; there is no scheduler, so stale objects can remain until a later preparation triggers cleanup. Abuse protection limits anonymous registration session issuance to 25 per two hours globally and profile sessions to 5 per account; the global cap can restrict a busy demo. Live Storage CORS, hosted Vercel, real Auth, and LINE acceptance remain pending.

## Upload review and migration 004 verification (2026-10-23)

A fresh independent review passed Standards and Spec with no blocking findings, including the final signed-token-expiry failure-path correction. The 33-test suite, typecheck, and diff check cover the final source. The four browser tests and production build passed immediately before that narrow correction; their normal-flow evidence was reused, while the changed error path was covered by the final unit suite. No additional source changes followed the review.

Migration 004 was applied from the reviewed local SQL file in the intended project `xewzqzgghdyublpcikgt`, wrapped in `BEGIN`/`COMMIT`, after preflight confirmed its table, bucket, and RPC were absent. Postflight verified: private staging bucket, 5,242,880-byte file limit, session RLS, denied `anon`/`authenticated` table access, denied browser RPC execution, and allowed service-role RPC execution.

Real PostgreSQL probes verified rejection of wrong-owner/wrong-flow claims, acceptance of a valid claim, replay and expired-session rejection, and rejection of the sixth profile session within the quota window. All synthetic sessions were enclosed in a separate transaction and rolled back. No Auth identities, business records, photo objects, or durable probe sessions were created. Proof: `/tmp/tonphueng-migration004-verified.png`. These SQL checks do not establish live Storage/CORS/Auth/LINE or hosted application acceptance.
