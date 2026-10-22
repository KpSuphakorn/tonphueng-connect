# Ticket 01 local test report

## Initial implementation checks (22 Oct 2026)

- `PATH=/Users/suphakorninsee/.local/bin:$PATH npm run typecheck` — passed.
- `PATH=/Users/suphakorninsee/.local/bin:$PATH npm test -- --reporter=dot` — passed, 10 tests.
- `PATH=/Users/suphakorninsee/.local/bin:$PATH npm run test:e2e` — passed, 3 browser tests on isolated port 4173; explicit web-server config used fake credentials and `http://127.0.0.1:4174` for Supabase.
- `PATH=/Users/suphakorninsee/.local/bin:$PATH npm run build` — passed with Next.js 16.4.2.
- Disposable PTY bootstrap check — passed: Unicode password reached only a local fake Supabase Auth server unchanged; deleting an appended supplementary Unicode character removed it as one codepoint; terminal output did not echo the password. The scratch working directory had no `.env.local`, and no real Auth user was created.

HTTP tests cover customer creation from verified LINE subject only, rejecting profile-only and invalid LINE token requests, initial Admin LINE compare-and-swap binding, mismatched Admin LINE, pending Staff denial, active Staff login, stored-role mismatch, logout revocation/cookie clearing, and expiry/hash filtering for persisted sessions. LINE and Supabase HTTP calls use local test doubles.

Browser tests cover the Staff login form, opening an offer to its truthful empty state, and denial of a tampered cookie on Staff/Admin pages.

## Initial Supabase and app configuration evidence (22 Oct 2026)

- The approved identity migration was applied manually in the Supabase SQL Editor inside a transaction (`BEGIN`/`COMMIT`). It was not applied through the Supabase CLI and no migration-history entry is claimed.
- SQL inspection confirmed `app_accounts` and `app_sessions` exist with RLS enabled, browser roles denied table access, and server `service_role` access granted. Screenshot evidence: `/tmp/tonphueng-supabase-rls.png`.
- A private, ignored `.env.local` was created with mode `0600`; it points to the intended Supabase project. The temporary credential transfer file was removed. `NEXT_PUBLIC_LINE_LIFF_ID` remains a placeholder because no LIFF app or HTTPS endpoint exists yet.
- Live read-only Data API checks succeeded for both tables using the service-role key; each count was zero. The publishable-key query to each table was denied with HTTP 401. No rows or user accounts were created.
- The original Playwright smoke run preceded explicit environment isolation. Since the protected-page case looks up a cookie session, that run may have made a read-only lookup against the configured project; it is not used as evidence of isolated browser testing. The latest run used only the explicit fake loopback Supabase endpoint and a local fake server, which logged two `/rest/v1/app_sessions` requests.

## Remaining live acceptance

The Vercel deployment and LIFF endpoint/scope are now configured and owner-verified. The owner reported the external Chrome flow returned to login and required role selection again; this is not successful acceptance. The callback continuation fix below remains local and awaits deployment. Customer login from LINE OA/chat, Customer callback continuation on a device, initial Admin binding and later matching login, approved Staff login, persisted session reopen, and logout followed by denied reopen still need manual verification with owner-controlled accounts.

## Callback continuation update (23 Oct 2026)

- `PATH=/Users/suphakorninsee/.local/bin:$PATH npm run typecheck` — passed.
- `PATH=/Users/suphakorninsee/.local/bin:$PATH npm test -- --reporter=dot` — passed, 33 tests.
- `PATH=/Users/suphakorninsee/.local/bin:$PATH npm run test:e2e` — passed, 11 browser tests total: 10 login/home/session checks and 1 Staff registration/profile browser flow.
- `PATH=/Users/suphakorninsee/.local/bin:$PATH npm run build` — passed with Next.js 16.4.2.
- Login browser coverage includes mount initialization without external login, explicit Customer callback continuation with one `/api/auth/line` POST and no second role choice, an already signed-in LIFF session, init failure followed by explicit retry, OAuth cancellation then explicit retry while preserving unrelated query parameters, Back then retry, persisted `pageshow` cancellation while initialization is pending, expired intent unlock, stale auth-response cancellation, and Staff/Admin form behavior.
- Browser tests use fake LIFF ID `2012159405-playwright-test`; all HTTPS traffic is intercepted or aborted. The local doubles cover `api.line.me/liff/v2/apps/{liffId}/contextToken`, `api.line.me/oauth2/v2.1/token`, `api.line.me/oauth2/v2.1/certs`, `access.line.me/liff/v1/authorize`, and static LIFF assets. The Staff browser spec aborts all HTTPS requests. Supabase remains pointed at the test loopback server. These are SDK/browser behavior checks, not native LINE in-client or live LINE acceptance.
- The Back regression verified that the browser returned to a retryable Customer form with the intent cleared. The persisted `pageshow` handler was exercised with a synthetic persisted event while initialization and auth responses were held pending; this does not establish that Chrome restored the page from its native BFCache.

## Callback review resolution (23 Oct 2026)

Independent review found two recovery defects: retained OAuth error parameters prevented retry, and a restored authorization page could remain busy. The production corrections passed a fresh targeted static review; its remaining test condition required exercising persisted `pageshow`. That focused test then exposed stale asynchronous authorization, corrected with per-attempt invalidation and covered through retry before initialization resolves. Manager verified the final guards before authorization and after the auth response, and the original review conditions are met locally.

The final production source passed typecheck, 11 browser checks, and a production build. The stale-response test was subsequently strengthened to await response completion and two render frames; that targeted check and typecheck passed without further production changes. The 33 Vitest checks preceded the final client-only corrections and are reused for the unchanged server code. This does not establish native LINE/BFCache or device acceptance. No new commit, push, or deployment was performed for this fix.

## Initial review notes (22 Oct 2026)

- Standards/security review: PASS, no actionable findings.
- Spec review: PASS, no actionable findings against Ticket 01.
- Cleanup delta review: PASS, no blockers; cleanup stayed within the ticket and removed only the three confirmed dead-code items alongside the two required fixes.
- This workspace has no committed implementation baseline; review covered the new approved files.
- TDD red stage: before the login routes were implemented, the HTTP test run failed because `/api/auth/line` did not exist. The green stage is the 10/10 HTTP result above.
- Staff/Admin UI copy describes their currently unimplemented capabilities as “ยังไม่เปิดใช้งาน”.
