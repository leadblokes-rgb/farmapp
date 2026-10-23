# Croppr

Croppr is a mobile app that matches Australian farms with agricultural workers, especially Working Holiday Makers (subclass 417/462) who need regional "specified work" days.

- **Workers** swipe through jobs, chat with farms, and track their visa days.
- **Farms** post jobs, then accept or decline applicants from a ranked shortlist.
- **Admins** verify farms in the Supabase dashboard.

| Path | What |
|---|---|
| `apps/mobile` | Expo SDK 57 (React Native + Expo Router) app for workers and farms |
| `packages/shared` | Shared TypeScript: generated DB types, enums, validation, config files |
| `packages/matching` | The ranking module (the only place match scoring lives) |
| `supabase/` | Postgres migrations, RLS policies, seed data, pgTAP tests, email templates |

## Prerequisites

- Node 22+ and npm
- Docker (for local Supabase)
- The **Expo Go** app on your phone, or an iOS simulator / Android emulator

## First-time setup

```bash
npm install                                     # installs every workspace
npm run db:start                                # starts local Supabase in Docker (first run downloads images)
cp apps/mobile/.env.example apps/mobile/.env.local
```

`npm run db:start` prints the local URLs and keys. `.env.example` already contains the standard local publishable key; if yours differs, paste the `Publishable key` from `npx supabase status`.

**Testing on a physical phone:** `127.0.0.1` points at the phone itself, not your computer. In `.env.local`, set `EXPO_PUBLIC_SUPABASE_URL=http://<your-computer-LAN-IP>:54321` (for example `http://192.168.1.20:54321`). The phone and computer must be on the same Wi-Fi.

## Running

```bash
npm run mobile          # starts Expo; scan the QR code with Expo Go (Android) or the Camera app (iOS)
```

Press `i` or `a` in the Expo terminal to open a simulator or emulator, or `w` to open the app in a browser.

| URL | What |
|---|---|
| http://127.0.0.1:54323 | Supabase Studio (database, auth users, admin tasks) |
| http://127.0.0.1:54324 | Mailpit: every email the local stack "sends", including sign-in codes |

## Demo accounts (local only)

Seeded by `supabase/seed.sql`. The password for all of them is `croppr-demo`. In a development build with `EXPO_PUBLIC_SHOW_DEMO_ACCOUNTS=true` in `apps/mobile/.env.local` (the default in `.env.example`), the sign-in screen shows one-tap buttons for these accounts. Set it to `false` when testing with real farms. Production builds never show them.

| Email | What you'll see |
|---|---|
| `worker@demo.croppr.test` | Worker "Sam Taylor" with a complete profile |
| `worker1@demo.croppr.test` … `worker24@demo.croppr.test` | More workers (mixed visas, cars, groups) across QLD |
| `farm@demo.croppr.test` | Verified farm: Lockyer Fresh Farms (Gatton) |
| `bundaberg-farm@` / `stanthorpe-farm@demo.croppr.test` | Verified farms in Bundaberg / Stanthorpe |
| `labourhire@demo.croppr.test` | Verified labour hire provider (Bowen) |
| `pending-farm@demo.croppr.test` | Farm waiting for verification (can't post jobs) |
| `rejected-farm@demo.croppr.test` | Rejected farm: shows the reason and can resubmit |
| `newuser@demo.croppr.test` | No role yet, so it shows the "choose your role" screen |
| `admin@demo.croppr.test` | Admin |

You can also sign up with any email address. The 6-digit code arrives in Mailpit.

## Using hosted Supabase instead of Docker

You don't need Docker if you use a free project on supabase.com.

1. Create a project at https://supabase.com/dashboard, in the **Sydney** region. Save the database password.
2. From the repo root:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push --include-seed
   npx supabase functions deploy rank-applicants
   npx supabase functions deploy send-push --no-verify-jwt
   ```
   - The project ref is the `xxxx` in `https://xxxx.supabase.co`.
   - `--include-seed` loads the demo accounts, which use the known password `croppr-demo`. Use a fresh project for real users.
3. In `apps/mobile/.env.local`, set:
   - `EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co`
   - `EXPO_PUBLIC_SUPABASE_KEY=<publishable or anon key>` (from Dashboard → Project Settings → API Keys)
4. Under Dashboard → Authentication → Emails → Templates, paste `supabase/templates/otp.html` into **Confirm signup** and **Magic link**, so emails show the 6-digit code. Supabase's built-in email sender only sends a few emails per hour; use the demo buttons for quick testing.
5. Optional, for push notifications later: in the SQL editor, run
   `select vault.create_secret('https://<ref>.supabase.co/functions/v1', 'functions_url');` and
   `select vault.create_secret('<service_role key>', 'service_role_key');`

## Expo SDK version

The app is on **Expo SDK 57**, so it opens in the current App Store/Play Store **Expo Go**. SDK 58 came out on 29 Sep 2026, before Expo Go supported it. Upgrade with `cd apps/mobile && npx expo install expo@^58 --fix` once Expo Go supports SDK 58 (check Expo Go → Settings → Supported SDK). Development builds aren't limited by Expo Go (see [`docs/dev-builds.md`](docs/dev-builds.md)).

## Branding

The original logo is `apps/mobile/assets/brand/croppr-logo-source.png`. The app icon, Android adaptive and monochrome icons, splash, favicon and welcome-screen logo are generated from it. Brand colours are in `apps/mobile/src/theme.ts` (`BRAND`).

## What's left before launch

See [`docs/launch-checklist.md`](docs/launch-checklist.md).

## Checks

```bash
npm run typecheck       # TypeScript, all workspaces
npm run lint            # ESLint (mobile app)
npm test                # Vitest unit tests (packages/*)
npm run db:reset        # re-apply all migrations + seed data from scratch
npm run db:test         # pgTAP tests for row-level security
npm run db:types        # regenerate packages/shared/src/database.types.ts after changing the schema
npm run build:functions # rebuild the matching bundle used by Edge Functions
npm run test:e2e        # browser end-to-end suites (see e2e/README.md)
```

## Rules that change: keep these up to date

| File | What | Review |
|---|---|---|
| `packages/shared/src/config/payRules.ts` | Horticulture Award casual minimum, used to warn farms posting underpaid jobs; piece-rate jobs must state a guaranteed hourly minimum | Every July, after the Fair Work Annual Wage Review |
| `packages/shared/src/config/visaRules.ts` | Specified-work day counting: 88/179 targets, full-time week = 7 days, full-day hours, short-shift handling, disclaimer text | Whenever Home Affairs changes its guidance |
| `packages/matching/src/weights.ts` | How much each factor counts in match scores | As you learn what farms value |

## Matching

All ranking logic lives in `packages/matching`. The `Ranker` interface has two methods:

- `rankJobsForWorker` orders the swipe feed.
- `rankApplicants` orders a farm's shortlist. It runs on the server in the `rank-applicants` Edge Function (`supabase/functions/rank-applicants`), so farms can't tamper with scores and never need raw worker data.

Each score comes with a per-factor breakdown that the app shows ("Available for the whole job", "9 km away"…). To try a smarter model later, implement `Ranker` and swap it in `packages/matching/src/index.ts`.

The database only *filters* candidates (`job_feed()`) and stores scores. It never ranks them.

Edge Functions run in Deno, so `npm run build:functions` bundles `packages/matching` into `supabase/functions/_shared/matching.js`. **Re-run it after changing matching or shared code.**

## Ratings, check-in and completion

- On a job's first day the farm marks each accepted worker as **turned up**, **no-show** or **left early** (Job → "Who turned up?").
- After the job's end date, workers marked as turned up become **completed**. This runs daily (`pg_cron`) and whenever someone opens their ratings.
- Workers then rate the farm, and farms rate workers who turned up. Ratings are **blind**: neither side sees the other's rating until both have rated, or 14 days have passed.
- Farm ratings are public to signed-in users. Worker ratings are visible only to farms the worker has applied to, and to the worker.
- Each no-show counts as a 1-star reliability rating in the ranking, unless the worker has disputed it and the Croppr team hasn't decided yet.
- Reviews can be reported; admins handle reports and disputes as described in the runbook.

## Admin tasks

Approving farms, suspending users and handling reports are done in the Supabase dashboard. Step-by-step instructions are in [`docs/admin-runbook.md`](docs/admin-runbook.md).

## Security model (summary)

- Every table has row-level security (RLS). Users can only read their own rows unless a policy explicitly allows more.
- `profiles.role` is chosen once (worker or farm). Nobody can make themselves an admin, through sign-up data, direct updates, or `set_my_role()`; admin is granted only from the dashboard. Suspended users lose access everywhere through the `is_active()` helper.
- The auth session is stored in the iOS Keychain or Android Keystore (`expo-secure-store`), never in plain AsyncStorage.
- Visa type, visa expiry and nationality live in `worker_private`, which only the worker can read. Farms will only ever get a yes/no answer to "does the visa cover the job dates?".
- Farms start as `pending`. Only admin functions (dashboard only) can verify them. Changing legal details sends a verified farm back for review.
- Worker photos are in a private storage bucket, served through short-lived signed URLs.
- No passport numbers, dates of birth or street addresses are collected. "Use my location" keeps only the postcode.
- The day tracker (employers, shifts, payslips) is visible only to the worker. Farms and the app's admin role can't read it. Payslip files are in a private bucket.
- Users can delete their account in the app (Profile → Delete my account), which also removes their photos and payslip files.

## Push notifications

Croppr sends push notifications in these cases:

- **New applicant:** sent to the farm.
- **Accepted / not this time:** sent to the worker.
- **New chat message:** sent to the other person.
- **Marked as a no-show:** sent to the worker, with a way to dispute it.
- **Job completed:** asks the worker to rate the farm.
- **Day one of a job:** reminds the farm to check in its crew (sent by the daily database job, 5:30am Queensland time).

Tapping a notification opens the right screen.

How it works:

1. Triggers on `applications` and `messages` call `public.notify()`.
2. `public.notify()` makes an async HTTP call (`pg_net`) to the `send-push` Edge Function.
3. `send-push` sends the message through the Expo Push API.

Every attempt is logged in `notification_log` (`select * from notification_log order by id desc`).

**To receive pushes on a phone**, use a development build (Expo Go can't receive them on Android, and needs extra setup on iOS). Step-by-step instructions for Windows and iPhone are in [`docs/dev-builds.md`](docs/dev-builds.md). Build profiles are in `apps/mobile/eas.json`.

Locally, `seed.sql` stores the function URL and service key in Supabase Vault.

## Going to production (later)

- Create a Supabase project and run `npx supabase link`, then `npx supabase db push`.
- In the dashboard, under **Auth → Email Templates**, make the *Confirm signup* and *Magic Link* templates show `{{ .Token }}` (see `supabase/templates/otp.html`). Otherwise users get a link instead of a code.
- Configure a real SMTP provider. Supabase's built-in email sender is heavily rate-limited.
- Push notifications need two Vault secrets in production. In the SQL editor, run:
  `select vault.create_secret('https://<project-ref>.supabase.co/functions/v1', 'functions_url');`
  `select vault.create_secret('<service role key>', 'service_role_key');`
  Then deploy the functions with `npx supabase functions deploy rank-applicants` and `npx supabase functions deploy send-push --no-verify-jwt`.
- The `postcodes` table only has a Queensland subset. Load the full Australian postcode list before launch, otherwise distance ranking won't work outside QLD.
