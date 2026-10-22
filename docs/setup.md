# Local setup guide

This guide prepares a local Ticket 01/02 demo. It does not create a live LINE LIFF app, apply database changes, or deploy the site.

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

If registration reports `cleanup_required` or `verify_required`, do not ask the applicant to retry immediately. A project Admin must use the logged reference, account ID, Auth user ID, owned photo object paths, and fixed cleanup failure labels to inspect the Auth identity, pending app account, and Service profile. A `verify_required` response means the Service write may have committed; if a complete Service profile exists, preserve the account and photos. Manual cleanup is only for a confirmed incomplete pending signup with no Service profile: remove only that signup's logged photo objects (or its verified object prefix), then delete its matching orphan Auth identity, which cascades its pending app account. For an uncertain profile edit, first verify which logged object paths the Service profile references; remove only confirmed unreferenced objects. Never delete an active account or a complete Service profile. If state is uncertain, preserve it and investigate before taking action. These steps are manual because Auth, Storage, and database cleanup cannot be guaranteed during an external service failure.

## 2. Configure LINE Login and LIFF

In LINE Developers, use the Tonphueng Connect provider and its LINE Login channel. Create a LIFF app for the web app, choose **Full** size, enable the `openid` scope, and set its endpoint to the HTTPS app URL. The `profile` scope is not needed for this ticket. For local-only development, use a local HTTPS tunnel that you control; `localhost` is not a production LIFF endpoint. Copy the resulting LIFF ID into `NEXT_PUBLIC_LINE_LIFF_ID` and set `LINE_LOGIN_CHANNEL_ID` to the matching **LINE Login channel ID**. This differs from the Messaging API channel ID shown in LINE Official Account Manager. The app sends the raw LIFF ID token to the server for LINE verification; it does not trust a browser-submitted profile ID.

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

Visit `http://localhost:3000`. The three account choices are separate: Customer uses LINE; Staff and Admin use email/password. A successful login creates an application session stored in Supabase. Signing out revokes the session. Staff can submit a business profile from `/staff/register`; it remains pending until an active Admin approves it. Approved Staff can read and edit only their own profile. Main, My Trip, and My Order show their Ticket 01 empty states until their later tickets add data and behavior.

Local checks:

```sh
npm run typecheck
npm test
npm run test:e2e
npm run build
```

The automated auth tests stub the LINE and Supabase HTTP boundaries. The Playwright server receives explicit fake credentials and a loopback Supabase URL, so browser tests do not use `.env.local` or contact the real project. These tests do not validate the live LINE channel, LIFF configuration, or a real owner login. A live demo still requires a configured LIFF app and HTTPS endpoint, then a manual sign-in check.
