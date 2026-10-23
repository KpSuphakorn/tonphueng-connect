# Local setup guide

This guide covers local setup and Vercel/LIFF setup for Tickets 01–05. Migrations 001–006 are applied to the connected project. The Vercel project uses the production variables below and domain `https://tonphueng-connect.vercel.app`. The owner configured LIFF `2012159405-T8XhzQkR` with Full size, `openid`, and endpoint `https://tonphueng-connect.vercel.app/login`; Customer, initial Admin binding, and approved Staff login have been reported successful. Full session and package workflow acceptance remains pending.

## 1. Install and start the app

Use Node.js 22 or later. For example, with nvm:

```sh
nvm install 22
nvm use 22
node --version
npm install
cp -n .env.example .env.local
```

Open `.env.local` in a local editor and replace the placeholders. `cp -n` leaves an existing file intact. Keep this file private; `.gitignore` excludes it. Do not paste credentials into chat or commit them.

Required values:

- `SUPABASE_URL`: Project URL from Supabase Project Settings → API.
- `SUPABASE_PUBLISHABLE_KEY`: the project's publishable key. This is used by the server for password sign-in.
- `SUPABASE_SERVICE_ROLE_KEY`: the server-only service-role key. Never add a `NEXT_PUBLIC_` prefix.
- `LINE_LOGIN_CHANNEL_ID`: the LINE Login channel ID under the Tonphueng Connect provider.
- `NEXT_PUBLIC_LINE_LIFF_ID`: the LIFF ID created under that LINE Login channel.
- `APP_ORIGIN`: exact app origin, such as `http://localhost:3000` for local use.

For a fresh Supabase project, review [`../supabase/migrations/202610220001_identity.sql`](../supabase/migrations/202610220001_identity.sql), confirm the target project, then apply it once in that project's SQL Editor. It creates identity and revocable-session tables with RLS enabled and browser roles denied table access. This repository does not use CLI migration history for this initial setup. The current project has already had this migration applied manually in a transaction; do not run it again there.

For a fresh project, review [`../supabase/migrations/202610220002_staff_approval.sql`](../supabase/migrations/202610220002_staff_approval.sql) and apply it after the identity migration. It creates the private business-photo bucket, the Service profile table, and an atomic Staff approval function. Browser roles have no table or function access; the server uses the service-role key after checking the application session. Staff photo uploads accept JPG, PNG, or WebP images up to 5 MB each, 19 images maximum, and 25 MB combined; the server decodes and normalizes them to WebP. This migration was applied manually in a transaction to the connected `tonphueng-connect` project on 2026-10-22 and verified: RLS is enabled, browser roles cannot select/approve, and the photo bucket is private with a 5 MiB limit. Do not run it again on that project.

Migration 003 adds the Service description and customer-saved My Trip relation. It was applied manually in a transaction to the connected `tonphueng-connect` project on 2026-10-23. The description constraint, saved-place composite primary key, two foreign keys, RLS, and denied browser-role access were verified in the SQL Editor. Do not run it again on that project. Live application acceptance is still pending.

Migration 004 adds the private `staff-photo-staging` bucket and service-role-only upload-session table/functions used by the Vercel-compatible Staff photo flow. It was applied with owner authorization in a transaction to the connected `tonphueng-connect` project on 2026-10-23. SQL checks verified the private 5 MiB bucket, session RLS, denied browser table/function access, and service-role function access. Real PostgreSQL probes verified owner/flow binding, one-use claims, expiry, and the profile-session quota; all probe rows were rolled back. Do not run it again on that project. The browser sends image bytes directly to Supabase Storage with one-path signed upload URLs; Vercel receives only bounded form metadata and an opaque one-use session token. The server downloads each staged image, checks actual bytes and decoded dimensions, normalizes it to WebP, and writes final photos to the existing private `staff-business-photos` bucket. App sessions expire after two hours; staged objects are retained until signed upload tokens expire (with a cleanup margin) and are removed in batches of at most 10 on later upload preparation. There is no scheduled cleanup. To limit anonymous registration abuse, the prototype permits at most 25 registration upload sessions per two-hour window globally and 5 profile sessions per account; the global signup cap can temporarily limit registrations during a busy demo. Each session can stage at most 19 files of up to 5 MiB each; the server also enforces the 25 MiB actual combined limit before publishing.

Ticket 04 migration 005 (`202610230005_packages.sql`) was applied with owner authorization on 2026-10-23. It adds category catalogue and Customer selection tables; RLS and denied browser table/RPC access were verified, while service-role RPC access is enabled. PostgreSQL probes verified catalogue revision conflicts, selection validation, server-derived price, and upsert; all probe data was rolled back. No durable catalogue or selection rows were seeded. Do not rerun this migration on the current project. Package prices are Admin-entered per-person demo amounts in integer satang; selections do not create Bookings or payments. Real Admin configuration and Customer selection acceptance is still pending. See the [Ticket 04 report](../agent-runs/04-package-selection/test-report.md).

Ticket 05 migration 006 (`202610230006_package_bookings.sql`) was applied with owner authorization in a transaction on 2026-10-23. It adds immutable Booking snapshots, simulated payment state, request idempotency, and a separate relation for places added from confirmed Bookings to My Trip. RLS, denied browser access and service-role RPC access were verified. Real SQL probes checked price/end date, replay, validation, ownership, confirmation and My Trip addition; all probe writes were rolled back. PostgREST exposes the new tables/RPCs and rejected invalid-owner probes without writes. No durable Bookings or trip places were seeded. Do not rerun it on the connected project. For a fresh project, review and apply it after migration 005. Hosted Customer/LINE booking acceptance remains pending; see the [Ticket 05 report](../agent-runs/05-package-booking/test-report.md).

### Vercel and LIFF setup

For a fresh project, obtain authorization to commit/push the reviewed local changes, then import `KpSuphakorn/tonphueng-connect` into Vercel with the Next.js preset, root directory `./`, and default install/build/output settings. Add the six server/runtime variables listed above; keep the service-role key server-only and set `APP_ORIGIN` to the production HTTPS origin without a path. Use the LIFF endpoint `https://<actual-project-domain>/login`, where this app initializes LIFF. The current project is already deployed at `https://tonphueng-connect.vercel.app` and its configured LIFF endpoint is `https://tonphueng-connect.vercel.app/login`. The callback-continuation fix is deployed. The owner reported successful Customer login from LINE, initial Admin binding, and approved Staff login; reopening, logout, and mismatched Admin LINE checks remain pending. The local `.env.local` still has a placeholder LIFF ID and was not changed. Verify in the deployed browser that Supabase Storage accepts signed `PUT` uploads with the `content-type` header from the app origin; local HTTP doubles do not establish live CORS behavior. The photo bytes go from the browser to Supabase Storage, so they do not pass through the Vercel function request body. Registration/approval/Staff login succeeded according to the owner. Profile replacement uploads and the remaining session checks still need live acceptance. This UI/CORS refinement remains local until separately authorized for release.

If registration reports `cleanup_required` or `verify_required`, do not ask the applicant to retry immediately. A project Admin must use the logged reference, account ID, Auth user ID, owned photo object paths, and fixed cleanup failure labels to inspect the Auth identity, pending app account, and Service profile. A `verify_required` response means the Service write may have committed; if a complete Service profile exists, preserve the account and photos. Manual cleanup is only for a confirmed incomplete pending signup with no Service profile: remove only that signup's logged photo objects (or its verified object prefix), then delete its matching orphan Auth identity, which cascades its pending app account. For an uncertain profile edit, first verify which logged object paths the Service profile references; remove only confirmed unreferenced objects. Never delete an active account or a complete Service profile. If state is uncertain, preserve it and investigate before taking action. These steps are manual because Auth, Storage, and database cleanup cannot be guaranteed during an external service failure.

## 2. Configure LINE Login and LIFF

In LINE Developers, use the Tonphueng Connect provider and its LINE Login channel `2012159405`. The current LIFF app is `2012159405-T8XhzQkR`, **Full** size, with `openid` scope and endpoint `https://tonphueng-connect.vercel.app/login`; the owner verified these settings in LINE Console. For a new project, create a LIFF app with those settings. The `profile` scope is not needed for this ticket. For local-only development, use a local HTTPS tunnel that you control; `localhost` is not a production LIFF endpoint. Set `NEXT_PUBLIC_LINE_LIFF_ID` to the resulting LIFF ID and `LINE_LOGIN_CHANNEL_ID` to the matching **LINE Login channel ID**. This differs from the Messaging API channel ID shown in LINE Official Account Manager. The app sends the raw LIFF ID token to the server for LINE verification; it does not trust a browser-submitted profile ID. To open LIFF in LINE, tap its URL from the LINE OA/chat entry; opening an HTTPS link in Chrome does not guarantee it will switch into LINE. See LINE's [LIFF opening guidance](https://developers.line.biz/en/docs/liff/opening-liff-app/) and [LIFF app development guidance](https://developers.line.biz/en/docs/liff/developing-liff-apps/). The login page initializes LIFF after load and only starts external LINE login after an explicit Customer action.

The Messaging API webhook and channel access token are not needed for Ticket 01 sign-in. LINE Login and Messaging API must belong to the same provider for later integration work.

## 3. Create the initial Admin

After the migration is applied and the Supabase server keys are configured, run this command in a terminal:

```sh
npm run bootstrap-admin -- owner@example.com
```

The command asks for a password with terminal input hidden. It creates the single initial Admin as pending and unbound to LINE. On the first Admin sign-in, enter that email and password, then confirm the LINE account through LIFF. The server verifies the LINE ID token and binds that verified LINE subject to this Admin exactly once. Pending Staff accounts remain blocked until an approved workflow activates them. Additional Admin invitations are outside Ticket 01.

## 4. Run and verify locally

```sh
npm run dev
```

Visit `http://localhost:3000`. The three account choices are separate: Customer uses LINE; Staff and Admin use email/password. A successful login creates an application session stored in Supabase. Signing out revokes the session. Staff can submit a business profile from `/staff/register`; it remains pending until an active Admin approves it. Approved Staff can read and edit only their own profile. Services, saved places, Packages and Booking/My Trip behavior are implemented through Ticket 05; Product/My Order workflows remain pending Tickets 06–07.

Local checks:

```sh
npm run typecheck
npm test
npm run test:e2e
npm run build
```

The automated auth tests stub the LINE and Supabase HTTP boundaries. The Playwright server receives explicit fake credentials and a loopback Supabase URL, so browser tests do not use `.env.local` or contact the real project. These tests do not validate the live LINE channel, LIFF configuration, or a real owner login. A live demo still needs manual login and persisted-session checks on a device against the deployed app; for the intended in-client path, open the LIFF link from LINE OA/chat.

## Public API for storypage

Base URL: `https://tonphueng-connect.vercel.app`. No API key or application session is required for these public read endpoints.

| Request | Response |
| --- | --- |
| `GET /api/services?category=tourism_trail&offset=0` | Tourism/trail Service profiles |
| `GET /api/services?category=community_product&offset=0` | Community-product businesses, not individual Products |
| `GET /api/services` | All active Staff Services |
| `GET /api/packages` | `{ categories }` with the published Package catalogue |

Service categories: `community_product`, `accommodation`, `restaurant`, `tourism_trail`, `other`. Omit `category` for all; invalid values return 400. Response: `{ services, hasMore, limit: 12 }`; increment `offset` by the returned count while `hasMore` is true. Optional `latitude` and `longitude` must be supplied together to sort by straight-line distance. Photo URLs are signed for one hour; fetch the list again when they expire.

```js
const response = await fetch(
  'https://tonphueng-connect.vercel.app/api/services?category=tourism_trail&offset=0'
);
if (!response.ok) throw new Error(`Service List: ${response.status}`);
const { services, hasMore } = await response.json();
```

Local CORS change: only GET/OPTIONS on `/api/services` and `/api/packages` allow `Access-Control-Allow-Origin: *`, including error responses. Do not send `credentials: 'include'`; private/write endpoints retain their existing restrictions. Production currently answers these GETs but requires release of this change before browser fetch from storypage works. No storypage source or private API authorization was changed. After an authorized push to `main`, wait for Vercel's automatic deployment to reach Ready, then verify the response header from storypage; a separate redeploy is unnecessary when the Git deployment succeeds.
