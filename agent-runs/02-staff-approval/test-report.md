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

The fresh targeted review passed both Standards and Spec, with no blocking findings. The previously identified write-outcome issues are resolved. At review time no remote migration or live acceptance had been performed; migration 002 was subsequently applied and its schema/security settings verified. Live Auth/Storage acceptance remains outstanding, and Ticket 02 was not committed or pushed.

## Supabase migration 002

Applied to the `tonphueng-connect` project in the Supabase SQL Editor on 2026-10-22, wrapped in `BEGIN`/`COMMIT`. The preflight showed no existing `services` table, photo bucket, or approval function. Postflight verified `services` exists with RLS enabled; `anon` and `authenticated` have no table SELECT; `staff-business-photos` is private with a 5 MiB file limit; `approve_staff_account(uuid)` exists and `anon` cannot execute it. No accounts or photo objects were created. Live Auth/Storage flow acceptance is still pending HTTPS hosting and LIFF setup.
