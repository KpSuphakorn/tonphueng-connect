# Local setup guide

This guide covers Tickets 01–10. Migrations 001–011 are applied to the connected project; 010 and 011 were applied in separate authorized SQL Editor transactions on 2026-10-23 and verified with 11 read-only metadata checks. Vercel functions run in `sin1` next to the Supabase `ap-southeast-1` database. The owner reports the core prototype, UI and manual ready for demonstration; current verification and remaining evidence limits are recorded in [features](features.md).

## Current live setup — 2026-10-23

| Entry | Current setting |
| --- | --- |
| Web app | [tonphueng-connect.vercel.app](https://tonphueng-connect.vercel.app) — deployed commit `c9a70e3` |
| LINE entry / Rich Menu target | [Open LIFF](https://liff.line.me/2012159405-T8XhzQkR) |
| LIFF configuration | LINE Login channel `2012159405`; LIFF `2012159405-T8XhzQkR`; Full size; `openid`; endpoint `https://tonphueng-connect.vercel.app/login` |
| LINE Official Account | ผึ้งพาเดิน `@114poiik` |
| User manual | [Download Thai PDF](https://tonphueng-connect.vercel.app/manual) |

The owner's LINE OA screenshots confirm the active Rich Menu links to LIFF and the welcome message contains the dynamic user-name tag. Chat and new-friend greeting are enabled; Webhook is off. These settings were reported/configured by the owner, not changed or freshly read from LINE Console in this readiness pass. A webhook is not required for this Rich Menu/LIFF entry or OA-managed greeting; AI chat remains optional.

Production page/catalog API and PDF download checks passed on 2026-10-23. Local validation passed 59 unit/HTTP tests, 22 browser tests, typecheck and production build; those automated tests use fake LINE/Supabase boundaries. No real-device LINE flow or business-data writes were performed in this pass. Payment confirmation remains simulated.

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

Optional integrations are disabled by default. Both Tickets 09 and 10 use the LINE Messaging API, so configure `LINE_MESSAGING_CHANNEL_SECRET` and `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` for either one. Ticket 09 also needs `GEMINI_API_KEY`, `LINE_CHAT_ENABLED=true`, and optionally a Lite-only `GEMINI_MODEL` primary (default `gemini-3.5-flash-lite`). On transient capacity errors or timeout, the chain can try `gemini-3.1-flash-lite` once within the same 8-second provider budget; it does not retry invalid credentials, invalid requests, or safety-blocked output. Ticket 10 also needs `CRON_SECRET` and `FEEDBACK_ENABLED=true`; it works with `LINE_CHAT_ENABLED=false` and does not need a Gemini key. Never put these secrets in a `NEXT_PUBLIC_` variable or source control. The LINE Messaging API channel secret/token are distinct from the LINE Login channel ID above. Point the Messaging API webhook to `https://<app-domain>/api/line/webhook`, enable webhook delivery and redelivery in LINE Developers, and check that OA auto-replies do not conflict with integration replies. Feedback replies must include the issued six-character code, for example `FB A1B2C3 ทริปสนุกมาก`; responses are linked by that code and the sender's LINE user identity.

Gemini calls use the Free Tier only if the Google Project/key is actually on Free Tier; quotas are per project and model, and Google may use Free Tier input/output to improve its products. Do not submit passwords, account identifiers, order/booking details, or other private information. Persisted server caps count logical requests (up to 50 per LINE user and 1,000 globally per Bangkok day); one logical request may make up to two provider attempts. These are app-side caps, do not represent Google's live limits, and cannot guarantee free service if the key is on a paid plan. No paid-model fallback is configured.

Migration 010 creates private event, conversation, usage-cap and Feedback tables/RPCs. The Manager applied it to the connected project with owner authorization on 2026-10-23, then applied migration 011 in a separate transaction. Migration 011 keeps the atomic quota function and raises the active caps to 50 logical requests per LINE user and 1,000 globally per Bangkok day. RLS, table/RPC grants, the immutable-payload trigger and cap definitions passed 11 read-only metadata checks. Do not rerun migration 010 on this project; fresh projects must apply 001–011 in order. These manual applications do not populate CLI migration history. The Vercel Cron configured in `vercel.json` runs daily at 03:00 UTC (10:00 Asia/Bangkok); Hobby runs one scheduled execution per day and the exact start time is approximate. Feedback uses `Booking.end_date + 3` in Asia/Bangkok, a persisted LINE retry key and a unique booking claim. Each run attempts up to six requests, claiming each immediately before its push. An authorized manual cron rerun can retry failed or uncertain requests with the same payload/key during LINE's 24-hour retry window; after that window an uncertain request remains for manual verification and must not be blindly resent with a new key. A 2xx response or accepted request ID means LINE accepted the push request, not that the recipient received it. Keep `FEEDBACK_ENABLED=false` until credentials and the live test account are ready; the schema migrations are already applied.

For a fresh Supabase project, review [`../supabase/migrations/202610220001_identity.sql`](../supabase/migrations/202610220001_identity.sql), confirm the target project, then apply it once in that project's SQL Editor. It creates identity and revocable-session tables with RLS enabled and browser roles denied table access. This repository does not use CLI migration history for this initial setup. The current project has already had this migration applied manually in a transaction; do not run it again there.

For a fresh project, review [`../supabase/migrations/202610220002_staff_approval.sql`](../supabase/migrations/202610220002_staff_approval.sql) and apply it after the identity migration. It creates the private business-photo bucket, the Service profile table, and an atomic Staff approval function. Browser roles have no table or function access; the server uses the service-role key after checking the application session. Staff photo uploads accept JPG, PNG, or WebP images up to 5 MB each, 19 images maximum, and 25 MB combined; the server decodes and normalizes them to WebP. This migration was applied manually in a transaction to the connected `tonphueng-connect` project on 2026-10-22 and verified: RLS is enabled, browser roles cannot select/approve, and the photo bucket is private with a 5 MiB limit. Do not run it again on that project.

Migration 003 adds the Service description and customer-saved My Trip relation. It was applied manually in a transaction to the connected `tonphueng-connect` project on 2026-10-23. The description constraint, saved-place composite primary key, two foreign keys, RLS, and denied browser-role access were verified in the SQL Editor. Do not run it again on that project. Live application acceptance is still pending.

Migration 004 adds the private `staff-photo-staging` bucket and service-role-only upload-session table/functions used by the Vercel-compatible Staff photo flow. It was applied with owner authorization in a transaction to the connected `tonphueng-connect` project on 2026-10-23. SQL checks verified the private 5 MiB bucket, session RLS, denied browser table/function access, and service-role function access. Real PostgreSQL probes verified owner/flow binding, one-use claims, expiry, and the profile-session quota; all probe rows were rolled back. Do not run it again on that project. The browser sends image bytes directly to Supabase Storage with one-path signed upload URLs; Vercel receives only bounded form metadata and an opaque one-use session token. The server downloads each staged image, checks actual bytes and decoded dimensions, normalizes it to WebP, and writes final photos to the existing private `staff-business-photos` bucket. App sessions expire after two hours; staged objects are retained until signed upload tokens expire (with a cleanup margin) and are removed in batches of at most 10 on later upload preparation. There is no scheduled cleanup. To limit anonymous registration abuse, the prototype permits at most 25 registration upload sessions per two-hour window globally and 5 profile sessions per account; the global signup cap can temporarily limit registrations during a busy demo. Each session can stage at most 19 files of up to 5 MiB each; the server also enforces the 25 MiB actual combined limit before publishing.

Ticket 04 migration 005 (`202610230005_packages.sql`) was applied with owner authorization on 2026-10-23. It adds category catalogue and Customer selection tables; RLS and denied browser table/RPC access were verified, while service-role RPC access is enabled. PostgreSQL probes verified catalogue revision conflicts, selection validation, server-derived price, and upsert; all probe data was rolled back. No durable catalogue or selection rows were seeded. Do not rerun this migration on the current project. Package prices are Admin-entered per-person demo amounts in integer satang; selections do not create Bookings or payments. Real Admin configuration and Customer selection acceptance is still pending. See the [Ticket 04 report](../agent-runs/04-package-selection/test-report.md).

Ticket 05 migration 006 (`202610230006_package_bookings.sql`) was applied with owner authorization in a transaction on 2026-10-23. It adds immutable Booking snapshots, simulated payment state, request idempotency, and a separate relation for places added from confirmed Bookings to My Trip. RLS, denied browser access and service-role RPC access were verified. Real SQL probes checked price/end date, replay, validation, ownership, confirmation and My Trip addition; all probe writes were rolled back. PostgREST exposes the new tables/RPCs and rejected invalid-owner probes without writes. No durable Bookings or trip places were seeded. Do not rerun it on the connected project. For a fresh project, review and apply it after migration 005. Hosted Customer/LINE booking acceptance remains pending; see the [Ticket 05 report](../agent-runs/05-package-booking/test-report.md).

Ticket 06 migration 007 (`202610230007_products_cart.sql`) was applied with owner authorization in a transaction on 2026-10-23. It adds private Product/cart tables, RLS and service-role RPCs, and extends existing private photo upload sessions for one Product photo. Real SQL probes verified authoritative pickup/delivery totals, mixed-store rejection, invalid-owner/quantity/address rejection, photo owner binding/one-use and stale-cart handling; every probe write was rolled back. PostgREST sees the three new tables and rejects an invalid Customer RPC call with `42501`. No durable Products or carts were seeded. Do not rerun this migration on the connected project. For a fresh project, review and apply it after migration 006. Delivery is an explicitly labelled demo fee of 5,000 satang; pickup is 0. Real concurrent transactions, Product photo upload through the hosted browser, and full Customer/LINE acceptance remain pending; see the [Ticket 06 report](../agent-runs/06-product-cart/test-report.md).

Ticket 07 migration 008 (`202610230008_product_orders.sql`) was applied by the owner in the SQL Editor inside one transaction on 2026-10-23 (`Success. No rows returned`); do not rerun it on the connected project. Real SQL/PostgREST probes and hosted acceptance remain pending. It adds `product_orders` and immutable `product_order_items` snapshots with RLS and browser roles denied, plus service-role RPCs: `create_product_order` (creates one Order from the Customer's saved single-store cart, prices it from active Products with the 5,000-satang demo delivery fee or 0 for pickup, and clears the cart in the same transaction; replaying the same request UUID returns the same Order), `confirm_product_order` (idempotent simulated payment, `payment_method = 'simulated_demo'`, no real money or bank verification) and `update_staff_product_order` (owning Staff only, paid Orders only, forward status changes, tracking optional for delivery and rejected for pickup). For a fresh or the connected project, review it and apply it once after migration 007, then verify RLS/grants and run rollback-only SQL/PostgREST probes as for earlier tickets. Local PGlite evidence is in the [Ticket 07 report](../agent-runs/07-product-orders/test-report.md).

Ticket 08 migration 009 (`202610230009_multi_role_accounts.sql`) was applied by the owner in the SQL Editor inside one transaction on 2026-10-23; do not rerun it on the connected project. It replaces the single-column unique constraint `app_accounts_auth_user_id_key` with the partial unique index `app_accounts_role_auth_user_id_key` on `(role, auth_user_id)`, so one email/password Auth user can hold one Staff row and one Admin row; the role/identity check constraint, LINE-subject uniqueness per role, RLS and grants are unchanged, and Customer stays LINE-only. Apply it once after migration 008 with owner authorization **before deploying the Ticket 08 code**: until it is applied, inviting an email that already has a Staff account, or registering as Staff with an email that already has an Admin account, is rejected by the old constraint (new emails still work). After applying, verify the index and constraint with rollback-only SQL probes as for earlier tickets. Do not roll the app back to code before Ticket 08 after accounts hold two roles: the old role-less lookup fails login (503) for those accounts until the extra rows are removed. Local PGlite evidence is in the [Ticket 08 report](../agent-runs/08-admin-invitation/test-report.md).

[`vercel.json`](../vercel.json) sets `"regions": ["sin1"]` so Vercel Functions run in Singapore next to Supabase and schedules the guarded daily Feedback endpoint. The feature remains off until its environment flag is enabled.

### Vercel and LIFF setup

For a fresh project, obtain authorization to commit/push the reviewed local changes, then import `KpSuphakorn/tonphueng-connect` into Vercel with the Next.js preset, root directory `./`, and default install/build/output settings. Add the six server/runtime variables listed above; keep the service-role key server-only and set `APP_ORIGIN` to the production HTTPS origin without a path. Use the LIFF endpoint `https://<actual-project-domain>/login`, where this app initializes LIFF. The current project is already deployed at `https://tonphueng-connect.vercel.app` and its configured LIFF endpoint is `https://tonphueng-connect.vercel.app/login`. The callback-continuation fix is deployed. The owner reported successful Customer login from LINE, initial Admin binding, and approved Staff login; reopening, logout, and mismatched Admin LINE checks remain pending. The local `.env.local` still has a placeholder LIFF ID and was not changed. Verify in the deployed browser that Supabase Storage accepts signed `PUT` uploads with the `content-type` header from the app origin; local HTTP doubles do not establish live CORS behavior. The photo bytes go from the browser to Supabase Storage, so they do not pass through the Vercel function request body. Registration/approval/Staff login succeeded according to the owner. Profile replacement uploads and the remaining session checks still need live acceptance. Ticket 06 uses migration 007, which is applied; its full hosted Product/cart workflow still needs acceptance. No additional environment variable is required.

If registration reports `cleanup_required` or `verify_required`, do not ask the applicant to retry immediately. A project Admin must use the logged reference, account ID, Auth user ID, owned photo object paths, and fixed cleanup failure labels to inspect the Auth identity, pending app account, and Service profile. A `verify_required` response means the Service write may have committed; if a complete Service profile exists, preserve the account and photos. Manual cleanup is only for a confirmed incomplete pending signup with no Service profile: remove only that signup's logged photo objects (or its verified object prefix), then delete its matching orphan Auth identity, which cascades its pending app account. For an uncertain profile edit, first verify which logged object paths the Service profile references; remove only confirmed unreferenced objects. Never delete an active account or a complete Service profile. If state is uncertain, preserve it and investigate before taking action. These steps are manual because Auth, Storage, and database cleanup cannot be guaranteed during an external service failure.

## 2. Configure LINE Login and LIFF

In LINE Developers, use the Tonphueng Connect provider and its LINE Login channel `2012159405`. The current LIFF app is `2012159405-T8XhzQkR`, **Full** size, with `openid` scope and endpoint `https://tonphueng-connect.vercel.app/login`; the owner verified these settings in LINE Console. For a new project, create a LIFF app with those settings. The `profile` scope is not needed for this ticket. For local-only development, use a local HTTPS tunnel that you control; `localhost` is not a production LIFF endpoint. Set `NEXT_PUBLIC_LINE_LIFF_ID` to the resulting LIFF ID and `LINE_LOGIN_CHANNEL_ID` to the matching **LINE Login channel ID**. This differs from the Messaging API channel ID shown in LINE Official Account Manager. The app sends the raw LIFF ID token to the server for LINE verification; it does not trust a browser-submitted profile ID. To open LIFF in LINE, tap its URL from the LINE OA/chat entry; opening an HTTPS link in Chrome does not guarantee it will switch into LINE. See LINE's [LIFF opening guidance](https://developers.line.biz/en/docs/liff/opening-liff-app/) and [LIFF app development guidance](https://developers.line.biz/en/docs/liff/developing-liff-apps/). The login page initializes LIFF after load and only starts external LINE login after an explicit Customer action.

The Messaging API webhook and channel access token are not needed for Ticket 01 sign-in. LINE Login and Messaging API must belong to the same provider for later integration work.

## 3. Create the initial Admin

After the migration is applied and the Supabase server keys are configured, run this command in a terminal:

```sh
npm run bootstrap-admin -- owner@example.com
```

The command asks for a password with terminal input hidden. It creates the single initial Admin as pending and unbound to LINE. On the first Admin sign-in, enter that email and password, confirm the LINE account through LIFF, then tick and submit the "ยืนยันรับสิทธิ์ผู้ดูแล" step. The server verifies the LINE ID token and binds that verified LINE subject to this Admin exactly once, only with that explicit acceptance. Pending Staff accounts remain blocked until an approved workflow activates them. Additional Admins are added from `/admin/admins` by an active Admin (Ticket 08) and follow the same acceptance and binding step.

## 4. Run and verify locally

```sh
npm run dev
```

Visit `http://localhost:3000`. The three account choices are separate: Customer uses LINE; Staff and Admin use email/password. A successful login creates an application session stored in Supabase. Signing out revokes the session. Staff can submit a business profile from `/staff/register`; it remains pending until an active Admin approves it. Approved Staff can read and edit only their own profile. Services, saved places, Packages and Booking/My Trip behavior are implemented through Ticket 05. Product/cart UI and APIs are implemented through Ticket 06 with migration 007 applied; Ticket 07 Orders are implemented locally and need migration 008.

Local checks:

```sh
npm run typecheck
npm test
npm run test:e2e
npm run build
```

The automated auth tests stub the LINE and Supabase HTTP boundaries. The Playwright server receives explicit fake credentials and a loopback Supabase URL, so browser tests do not use `.env.local` or contact the real project. These tests do not validate the live LINE channel, LIFF configuration, or a real owner login. A live demo still needs manual login and persisted-session checks on a device against the deployed app; for the intended in-client path, open the LIFF link from LINE OA/chat.

## 5. Demo data

[`scripts/seed-demo.ts`](../scripts/seed-demo.ts) seeds demo business content from [`scripts/demo-data/catalog.ts`](../scripts/demo-data/catalog.ts) under the spec's prototype demo-data policy. It creates 12 active Staff accounts (`demo-<category>-<n>@example.com`, 3 each for community products, accommodation, restaurants and tourism/trails), one Service each with 2 business photos near the Ban Ton Phueng trail start, 3 Products with photos for each community-product store, and 2 Sub Packages for each Package category, with slot options limited to the seeded Services. It also adds activity for the back office:

- **3 pending Staff applicants** (`demo-pending-<n>@example.com`: accommodation, restaurant, and `other` with `other_category`), each with a full Service profile and 2 photos, so `/admin` has applications to approve.
- **3 Customers.** They are LINE-only rows whose `line_subject` is `demo-customer-<n>`, which can never match a real LINE id (`U` + 32 hex). They cannot sign in, and the schema stores no Customer name.
- **5 Bookings** on the demo Sub Packages, created with `create_package_booking`. Start dates are 8–31 days after the run date (Bangkok time), with 1–6 participants. Three are paid with `confirm_package_booking` and added to My Trip with `add_booking_to_my_trip`. Two stay pending.
- **5 Product Orders** on the 3 demo community stores. Each goes through `save_customer_cart`, `create_product_order` and `confirm_product_order`, then `update_staff_product_order`. Together they cover paid, preparing (pickup), shipping with tracking number `EF582630417TH` (delivery), delivered (pickup), and one left pending payment.

Per the owner's decision, visible text does not say "demo". Seeded records are identified by their `@example.com` accounts (Auth `app_metadata.tonphueng_demo_seed`), fixed Product ids, and fixed Sub Package ids. Names, addresses, prices and packages are invented and are not real offers, agreements or route permissions. Phone numbers are non-routable placeholders (`000-000-…`).

Photos are from Wikimedia Commons under CC BY/BY-SA/CC0/public-domain terms. Descriptions carry no credit line; the required attribution (author, license and source page for each file, from `PHOTO_CREDITS` in the catalog) is shown on the `/credits` page linked from the home page. Keep these attributions if the copy is edited.

```sh
npm run seed-demo -- --dry-run                       # local validation and plan; no network or secrets
DEMO_STAFF_PASSWORD='<12–72 chars>' npm run seed-demo  # create or update; safe to rerun
npm run seed-demo -- --remove                        # delete everything the script created
```

The seed needs the Supabase server keys in `.env.local`. `DEMO_STAFF_PASSWORD` may also go in `.env.local`. It becomes the login password for all demo Staff accounts, including the applicants, and is never printed. Reruns find accounts by email, re-sync the password, update changed fields, skip existing photo uploads, and remove only unreferenced photos inside demo account folders. Package catalogs keep all existing Sub Packages and Package text. Demo Sub Packages are added to them, or replaced on later runs, through `save_package_catalog` with the current revision. An empty Package description gets demo copy. A category is skipped with a message if it would exceed 12 Sub Packages. Rerun behaviour for the activity data:

- An applicant the owner has already approved keeps its status; only its profile is refreshed.
- Bookings and Orders use fixed request UUIDs and are looked up first, so they are never created twice.
- Order statuses only move forward, so a status the owner advanced while signed in as demo Staff is kept.

`--remove` runs in this order:

1. It deletes the demo Customer rows. This cascades their Bookings, My Trip rows, carts, package selections and Orders, so no DELETE grant on `package_bookings` or `product_orders` is needed for them.
2. It takes the demo Sub Packages out of the catalogs.
3. It deletes the carts, cart items and Orders that real Customers placed with demo stores (Order items cascade).
4. It deletes the photos and Auth users of the demo stores and applicants, which cascades their Staff accounts, Services and Products.

Bookings by real Customers keep their snapshots. The service role on the connected project cannot delete `product_orders`. So if real Customers have Orders with demo stores, the command stops and prints the exact SQL to run in the SQL Editor; rerun it afterwards. With no such Orders, it never tries the delete.

To delete one old test store: `npm run seed-demo -- --delete-test-store <serviceId>` prints the store name, owner email, and what it will delete. Rerun with `--yes` to proceed. It refuses if the owner is not Staff or is a demo account. If the owner's Auth user also holds an Admin role, only the Staff row is removed. It warns when a Package still lists the deleted store, which must then be edited in `/admin/packages`.

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

Released in `c4063d6`: only GET/OPTIONS on `/api/services` and `/api/packages` allow `Access-Control-Allow-Origin: *`, including error responses. Do not send `credentials: 'include'`; private/write endpoints retain their existing restrictions. Production verification returned GET 200 and OPTIONS 204 for these APIs, invalid category 400 with CORS, and private My Trip 403 without CORS. No storypage source or private API authorization was changed.

## User manual

`GET /manual` downloads `public/downloads/tonphueng-connect-manual.pdf`. The source is [`docs/manual/manual.html`](manual/manual.html) with screenshots in `docs/manual/images/`. To update it, edit the HTML, open it in Chrome/Chromium and print to PDF (A4, background graphics on, margins none), then replace the file in `public/downloads/` with the same name.

The deployed download returned a PDF on 2026-10-23. All 23 image references in the HTML source resolve to local files; the rendered cover was visually checked. This does not constitute a page-by-page layout review of the PDF.
