# Ticket 09 local implementation evidence

**Status:** implementation-complete-awaiting-live-acceptance

## Checks run

- `PATH=/Users/suphakorninsee/.local/bin:$PATH npm run typecheck` — passed.
- `PATH=/Users/suphakorninsee/.local/bin:$PATH npx vitest run tests/chat-assistance.test.ts` — 1 file, 12 tests passed, covering default-off, one-call primary success, transient 429 fallback, two-model exhaustion, no fallback on HTTP 400/401/403 or safety block, timeout fallback within the 8-second total budget, duplicate Lite model de-duplication, and quota cap rejection before provider calls.
- `PATH=/Users/suphakorninsee/.local/bin:$PATH npm test` — 13 files, 81 tests passed.
- `PATH=/Users/suphakorninsee/.local/bin:$PATH npm run build` — passed; Next.js lists both new API routes.
- An independent read-only recovery review passed after the webhook retry, stale-claim recovery, and bounded-batch corrections; this is focused review evidence, not a security certification.
- Local signature tests reject a modified signature before any fetch, accept LINE's empty verification body without side effects, prioritize explicit Feedback while AI is off, retry a pre-send feedback-storage failure without sending first, and suppress a duplicate completed event reply.
- Chat HTTP tests verify default-off makes no network request, persisted logical-request quota is checked before Gemini, structured JSON output and satang units are used, only whitelisted facts render, private-data requests bypass Gemini, and provider fallback is limited to two stable Lite models within one 8-second budget. Provider attempts are not counted separately by the database quota.
- PGlite applied migration 010 followed by 011 only to a local fixture. It verified per-user 49→50 and global 999→1000 acceptance, then denial at each cap, RLS and service-role-only function/table grants. Migration 011 does not reset usage rows. Separately, the Manager applied migrations 010 and 011 to Supabase project `xewzqzgghdyublpcikgt` in separate authorized SQL Editor transactions on 2026-10-23. Both returned success; 11 read-only metadata checks passed for tables, RLS, table/RPC grants, immutable trigger and active 1000/50 caps. No business RPCs or live provider calls were executed. CLI migration history was not populated. This coder did not access the connected database.
- `git diff --check` — passed.

## Implementation boundary

The webhook verifies HMAC-SHA256 over bounded raw bytes before parsing or service calls. Gemini receives bounded user text after common credential/contact/identifier redaction, a small allowlisted public catalogue, and bounded conversation history; it returns only catalogue IDs and fixed intents. The server renders current catalogue facts and fixed app paths. Chat has no transaction tools. Chat and Feedback remain disabled by default.

## Still pending

No real LINE webhook/push or Gemini request was sent, and nothing was deployed. The schema is applied, but application changes remain local. Live model quality/follow-up behavior, LINE retry delivery, hosted cron execution, actual Free Tier status/quota and device acceptance remain unverified. Gemini Free Tier data may be used by Google to improve its products; never submit private information, and an API key on a paid project can incur charges despite app-side caps.

## Flex presentation extension — 23 October 2026

- `PATH=/Users/suphakorninsee/.local/bin:$PATH npx vitest run tests/chat-assistance.test.ts tests/line-webhook.test.ts tests/trip-feedback.test.ts` — 3 files, 31 tests passed. Added coverage for capped carousel cards, safe detail origins, exact satang rendering, image omission, relevant quick replies, active catalogue image lookup and JPEG conversion, inactive package-linked services, invalid image addresses, and durable webhook reply-attempt ordering for Flex messages.
- `PATH=/Users/suphakorninsee/.local/bin:$PATH npm run typecheck` — passed.
- `git diff --check` — passed.
- The image route reads only an active service/product/package ID, verifies associated Staff is active, uses trusted stored object paths, bounds source size/pixels and returns a cropped JPEG with `no-store`. It makes no arbitrary URL fetch. LINE cards keep the plain response text in conversation history; Feedback still sends plain text.
- `/tmp/line-chat-simulator.json` is built from three public service rows; `/tmp/line-chat-long-simulator.json` uses synthetic long-title product/package/service text. Both are Flex messages from the production builder with only preview `hero.url` values replaced by the rows' signed photo URLs. These temporary simulator fixtures do not change production URLs or repository files.
- No LINE/Gemini call, deployment, migration, or external write was performed. Flex display and tap behavior in the LINE app remain unverified.

## Follow-up checks — 24 October 2026

- After neutralizing the remaining fixed chat copy, `PATH=/Users/suphakorninsee/.local/bin:$PATH npx vitest run tests/chat-assistance.test.ts` passed (1 file, 20 tests).
- `PATH=/Users/suphakorninsee/.local/bin:$PATH npm run build` passed; Next.js included `/api/line/catalogue-image` and `/api/line/webhook` in the production route list.
- Manager's LINE Flex Simulator checks used three public service rows with preview-only signed photo URL substitutions (`/tmp/line-chat-simulator-desktop.png`, `/tmp/line-chat-simulator-cards.png`), a long Thai title and price (`/tmp/line-chat-simulator-long.png`), and a no-image card (`/tmp/line-chat-simulator-no-image.png`). The local layout detector returned no findings. These previews do not verify a LINE device or an actual message send.
- The independent Reviewer passed the local implementation and Simulator scope; live LINE acceptance remains pending.
