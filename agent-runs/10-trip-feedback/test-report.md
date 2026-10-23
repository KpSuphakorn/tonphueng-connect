# Ticket 10 local implementation evidence

**Status:** implementation-complete-awaiting-live-acceptance

## Checks run

- `PATH=/Users/suphakorninsee/.local/bin:$PATH npm run typecheck` — passed.
- `PATH=/Users/suphakorninsee/.local/bin:$PATH npx vitest run tests/line-webhook.test.ts tests/chat-assistance.test.ts tests/trip-feedback.test.ts` — 3 files, 15 tests passed after the final recovery regressions.
- `PATH=/Users/suphakorninsee/.local/bin:$PATH npm test` — 13 files, 74 tests passed after the final recovery regressions.
- `PATH=/Users/suphakorninsee/.local/bin:$PATH npm run build` — passed.
- An independent read-only recovery review passed after the feedback retry-window, per-run exclusion, and webhook recovery corrections; this is focused review evidence, not a security certification.
- Cron route tests reject missing authorization and return without database access while Feedback is disabled. Feedback is independently disabled while Chat is disabled.
- Controlled LINE HTTP tests verify a persisted retry key/payload is sent after an atomic claim, an accepted-request ID is recorded as `accepted`, and a 503 is recorded as `uncertain` with no accepted ID or sent timestamp.
- The sender claims one request at a time immediately before each push and checks a 60-second margin against the stored 24-hour retry deadline before sending. A fake-clock test advances seven seconds during the first LINE request and verifies a second request with an expired retry window is not pushed.
- PGlite probe at `/tmp/tonphueng-pglite/probe010.mjs` applied migration 010 to a minimal local prerequisite schema. For a booking ending 2026-10-21, 2026-10-23 16:59 UTC (23:59 Asia/Bangkok) was not due; 17:00 UTC (2026-10-24 00:00 Asia/Bangkok) was due. The generated six-character code appeared in the immutable request payload. A second due booking was claimed when the first request ID was excluded for that run. A retry at 2026-10-24 16:58:59 UTC reclaimed the original row with the same retry key and payload; the active sending lease prevented another claim for that row, and excluding the first row let the healthy second booking proceed. At the 24-hour boundary, a query without exclusions left the uncertain request unreclaimed. The fixture also verified payload immutability, save by matching LINE subject/code, duplicate feedback rejection, event lock busy/retry/dedup, stale processing recovery after lease expiry, no replay after reply-attempt marking, anon denied access, and service-role access.
- `git diff --check` — passed.

## Implementation boundary

The claim uses paid-simulated bookings and `end_date + 3` in Asia/Bangkok, stores one immutable recipient/payload/retry key per booking, and claims one request at a time while excluding IDs already attempted during that run. It reclaims retryable sends only within a conservative 24-hour window using the same key and payload. Beyond that LINE retry window, uncertain sends remain manual. A stale `sending` state becomes `uncertain`. The cron endpoint uses constant-time bearer comparison and runs daily from Vercel configuration. `FEEDBACK_ENABLED` remains false by default. LINE request acceptance does not establish recipient delivery. Feedback storage errors before a reply attempt return a retryable webhook response; after a reply attempt starts, the event remains uncertain and is not blindly resent. The webhook route processes at most two claimed events per invocation and its per-user claim lease exceeds its 45-second runtime cap; unprocessed events receive a retryable response.

## Still pending

The Manager applied migrations 010–011 to Supabase project `xewzqzgghdyublpcikgt` in separate owner-authorized SQL Editor transactions on 2026-10-23; 11 read-only schema/RLS/grant/trigger/cap checks passed. Behavioral probes above remain local PGlite evidence; no business RPC, real LINE message, hosted cron or deployment was run. LINE Messaging API credentials, `CRON_SECRET`, real-account acceptance and actual Hobby schedule timing remain pending.
