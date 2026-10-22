# Ticket 03 local implementation checks

Local implementation and a fresh independent review are complete. Migration 003 was subsequently applied to the connected Supabase project with user authorization and its schema/access settings verified. No live Auth signup, Storage upload, LINE, or hosting requests were made.

## Results

- `PATH=/Users/suphakorninsee/.local/bin:$PATH npm test` — passed, 3 files and 25 tests. HTTP doubles cover omitted/valid/invalid categories, active Staff visibility, public response fields, GPS ordering across offset pages and coordinate validation, CSRF, pending Staff denial, two Customer accounts, and save/read/remove persistence.
- `PATH=/Users/suphakorninsee/.local/bin:$PATH npm run test:e2e` — passed, 4 browser tests. The Ticket 02 flow now continues through Staff description edit, Customer service discovery and details, GPS denied/allowed, a delayed stale-filter response, save to My Trip, and reload persistence. The browser app uses a loopback fake Supabase server and seeded test sessions.
- `PATH=/Users/suphakorninsee/.local/bin:$PATH npm run typecheck` — passed.
- `PATH=/Users/suphakorninsee/.local/bin:$PATH npm run build` — passed with Next.js 16.4.2. Next.js loaded `.env.local` during the build; credential values were not printed. This build result is not evidence of live Supabase or LINE integration.
- `git diff --check` — passed.

## Limits and pending acceptance

- Migration [`202610220003_service_discovery.sql`](../../supabase/migrations/202610220003_service_discovery.sql) adds Service description and the private My Trip saved-service relation. It was applied with user authorization on 2026-10-23; live application flows remain unverified.
- HTTP and browser checks use local service doubles. They do not verify PostgreSQL/RLS behavior, signed-photo access on the real project, LIFF/LINE login, or hosted browser behavior.
- GPS ordering loads all active services in the filtered catalogue before slicing, so every offset page uses the same global straight-line order. This is suitable for the current prototype scale; move distance sorting into Postgres if the catalogue grows substantially.
- Staff service descriptions start empty for existing and newly registered profiles until Staff add them. Existing auth and profile ownership checks remain server-side.

## Independent review

Fresh read-only review against `aec0c9c` passed Standards and Spec with no blocking findings. It checked active Staff filtering, public response fields, Customer ownership and same-origin writes, Staff ownership, migration privacy grants, and stale-filter/loading guards. No source correction was required. The reviewer reused the recorded local checks; some fake-service fixtures already filter inactive records, so only a real PostgreSQL/Supabase acceptance check can establish those production behaviors. At review time, migration 003 and live acceptance were pending. Migration 003 was subsequently applied as recorded below; live acceptance remains pending.

## Supabase migration 003

Applied the reviewed SQL manually in a `BEGIN`/`COMMIT` transaction to `tonphueng-connect` on 2026-10-23. Preflight confirmed the description column and saved-place table did not exist. Postflight verified: non-null Service description with the 4000-character constraint; saved-place RLS enabled; `anon` and `authenticated` have no SELECT/INSERT/UPDATE/DELETE; two foreign keys and a two-column primary key; server SELECT/INSERT/DELETE available (Supabase default service-role maintenance grants are also present). No demo accounts, saved places, or photos were seeded. This verifies the migration, not live app/LINE acceptance.
