# Ticket 01 local test report

## Checks

- `PATH=/Users/suphakorninsee/.local/bin:$PATH npm run typecheck` — passed.
- `PATH=/Users/suphakorninsee/.local/bin:$PATH npm test -- --reporter=dot` — passed, 10 tests.
- `PATH=/Users/suphakorninsee/.local/bin:$PATH npm run test:e2e` — passed, 3 browser tests on isolated port 4173; explicit web-server config used fake credentials and `http://127.0.0.1:4174` for Supabase.
- `PATH=/Users/suphakorninsee/.local/bin:$PATH npm run build` — passed with Next.js 16.4.2.
- Disposable PTY bootstrap check — passed: Unicode password reached only a local fake Supabase Auth server unchanged; deleting an appended supplementary Unicode character removed it as one codepoint; terminal output did not echo the password. The scratch working directory had no `.env.local`, and no real Auth user was created.

HTTP tests cover customer creation from verified LINE subject only, rejecting profile-only and invalid LINE token requests, initial Admin LINE compare-and-swap binding, mismatched Admin LINE, pending Staff denial, active Staff login, stored-role mismatch, logout revocation/cookie clearing, and expiry/hash filtering for persisted sessions. LINE and Supabase HTTP calls use local test doubles.

Browser tests cover the Staff login form, opening an offer to its truthful empty state, and denial of a tampered cookie on Staff/Admin pages.

## Supabase connection evidence

- The approved identity migration was applied manually in the Supabase SQL Editor inside a transaction (`BEGIN`/`COMMIT`). It was not applied through the Supabase CLI and no migration-history entry is claimed.
- SQL inspection confirmed `app_accounts` and `app_sessions` exist with RLS enabled, browser roles denied table access, and server `service_role` access granted. Screenshot evidence: `/tmp/tonphueng-supabase-rls.png`.
- A private, ignored `.env.local` was created with mode `0600`; it points to the intended Supabase project. The temporary credential transfer file was removed. `NEXT_PUBLIC_LINE_LIFF_ID` remains a placeholder because no LIFF app or HTTPS endpoint exists yet.
- Live read-only Data API checks succeeded for both tables using the service-role key; each count was zero. The publishable-key query to each table was denied with HTTP 401. No rows or user accounts were created.
- The original Playwright smoke run preceded explicit environment isolation. Since the protected-page case looks up a cookie session, that run may have made a read-only lookup against the configured project; it is not used as evidence of isolated browser testing. The latest run used only the explicit fake loopback Supabase endpoint and a local fake server, which logged two `/rest/v1/app_sessions` requests.

## Remaining live acceptance

LINE LIFF sign-in and real role/session flows remain unverified. There is no LIFF ID/endpoint or HTTPS host, and no initial Admin Auth user has been created. Customer LINE login, owner Admin first binding and later matching login, approved Staff login, persisted session reopen, and logout followed by denied reopen still need a manual check after LINE setup and account provisioning.

## Review notes

- Standards/security review: PASS, no actionable findings.
- Spec review: PASS, no actionable findings against Ticket 01.
- Cleanup delta review: PASS, no blockers; cleanup stayed within the ticket and removed only the three confirmed dead-code items alongside the two required fixes.
- This workspace has no committed implementation baseline; review covered the new approved files.
- TDD red stage: before the login routes were implemented, the HTTP test run failed because `/api/auth/line` did not exist. The green stage is the 10/10 HTTP result above.
- Staff/Admin UI copy describes their currently unimplemented capabilities as “ยังไม่เปิดใช้งาน”.
