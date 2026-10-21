# Croppr

Croppr is a mobile app that matches Australian farms with agricultural workers, especially Working Holiday Makers (subclass 417/462) who need regional "specified work" days.

- **Workers** swipe through jobs, chat with farms, and track their visa days.
- **Farms** post jobs, then accept or decline applicants from a ranked shortlist.
- **Admins** verify farms in the Supabase dashboard.

| Path | What |
|---|---|
| `apps/mobile` | Expo (React Native + Expo Router) app for workers and farms |
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

Seeded by `supabase/seed.sql`. The password for all of them is `croppr-demo`. In a development build, the sign-in screen shows one-tap buttons for these accounts.

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

## Checks

```bash
npm run typecheck       # TypeScript, all workspaces
npm run lint            # ESLint (mobile app)
npm test                # Vitest unit tests (packages/*)
npm run db:reset        # re-apply all migrations + seed data from scratch
npm run db:test         # pgTAP tests for row-level security
npm run db:types        # regenerate packages/shared/src/database.types.ts after changing the schema
npm run build:functions # rebuild the matching bundle used by Edge Functions
```

## Rules that change: keep these up to date

| File | What | Review |
|---|---|---|
| `packages/shared/src/config/payRules.ts` | Horticulture Award casual minimum, used to warn farms posting underpaid jobs; piece-rate jobs must state a guaranteed hourly minimum | Every July, after the Fair Work Annual Wage Review |
| `packages/shared/src/config/visaRules.ts` (milestone 6) | Specified-work day counting rules | Whenever Home Affairs changes the rules |
| `packages/matching/src/weights.ts` | How much each factor counts in match scores | As you learn what farms value |

## Matching

All ranking logic lives in `packages/matching`. The `Ranker` interface has two methods:

- `rankJobsForWorker` orders the swipe feed.
- `rankApplicants` orders a farm's shortlist. It runs on the server in the `rank-applicants` Edge Function (`supabase/functions/rank-applicants`), so farms can't tamper with scores and never need raw worker data.

Each score comes with a per-factor breakdown that the app shows ("Available for the whole job", "9 km away"…). To try a smarter model later, implement `Ranker` and swap it in `packages/matching/src/index.ts`.

The database only *filters* candidates (`job_feed()`) and stores scores. It never ranks them.

Edge Functions run in Deno, so `npm run build:functions` bundles `packages/matching` into `supabase/functions/_shared/matching.js`. **Re-run it after changing matching or shared code.**

## Admin tasks

Approving farms, suspending users and (from milestone 5) handling reports are done in the Supabase dashboard. Step-by-step instructions are in [`docs/admin-runbook.md`](docs/admin-runbook.md).

## Security model (summary)

- Every table has row-level security (RLS). Users can only read their own rows unless a policy explicitly allows more.
- `profiles.role` is chosen once (worker or farm). Nobody can make themselves an admin, through sign-up data, direct updates, or `set_my_role()`; admin is granted only from the dashboard. Suspended users lose access everywhere through the `is_active()` helper.
- The auth session is stored in the iOS Keychain or Android Keystore (`expo-secure-store`), never in plain AsyncStorage.
- Visa type, visa expiry and nationality live in `worker_private`, which only the worker can read. Farms will only ever get a yes/no answer to "does the visa cover the job dates?".
- Farms start as `pending`. Only admin functions (dashboard only) can verify them. Changing legal details sends a verified farm back for review.
- Worker photos are in a private storage bucket, served through short-lived signed URLs.
- No passport numbers, dates of birth or street addresses are collected. "Use my location" keeps only the postcode.
- Users can delete their account in the app (Profile → Delete my account).

## Going to production (later)

- Create a Supabase project and run `npx supabase link`, then `npx supabase db push`.
- In the dashboard, under **Auth → Email Templates**, make the *Confirm signup* and *Magic Link* templates show `{{ .Token }}` (see `supabase/templates/otp.html`). Otherwise users get a link instead of a code.
- Configure a real SMTP provider. Supabase's built-in email sender is heavily rate-limited.
- The `postcodes` table only has a Queensland subset. Load the full Australian postcode list before launch, otherwise distance ranking won't work outside QLD.
