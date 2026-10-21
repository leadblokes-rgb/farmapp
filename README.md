# FarmMatch

FarmMatch is a mobile app that matches Australian farms with agricultural workers, especially Working Holiday Makers (subclass 417/462) who need regional "specified work" days.

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

Seeded by `supabase/seed.sql`. The password for all of them is `farmmatch-demo`. In a development build, the sign-in screen shows one-tap buttons for these accounts.

| Email | Role |
|---|---|
| `worker@demo.farmmatch.test` | Worker |
| `farm@demo.farmmatch.test` | Farm |
| `newuser@demo.farmmatch.test` | No role yet, so it shows the "choose your role" screen |
| `admin@demo.farmmatch.test` | Admin |

You can also sign up with any email address. The 6-digit code arrives in Mailpit.

## Checks

```bash
npm run typecheck       # TypeScript, all workspaces
npm run lint            # ESLint (mobile app)
npm test                # Vitest unit tests (packages/*)
npm run db:reset        # re-apply all migrations + seed data from scratch
npm run db:test         # pgTAP tests for row-level security
npm run db:types        # regenerate packages/shared/src/database.types.ts after changing the schema
```

## Security model (summary)

- Every table has row-level security (RLS). Users can only read their own rows unless a policy explicitly allows more.
- `profiles.role` is chosen once (worker or farm). Nobody can make themselves an admin, through sign-up data, direct updates, or `set_my_role()`; admin is granted only from the dashboard. Suspended users lose access everywhere through the `is_active()` helper.
- The auth session is stored in the iOS Keychain or Android Keystore (`expo-secure-store`), never in plain AsyncStorage.
- No passport numbers are collected.

## Going to production (later)

- Create a Supabase project and run `npx supabase link`, then `npx supabase db push`.
- In the dashboard, under **Auth → Email Templates**, make the *Confirm signup* and *Magic Link* templates show `{{ .Token }}` (see `supabase/templates/otp.html`). Otherwise users get a link instead of a code.
- Configure a real SMTP provider. Supabase's built-in email sender is heavily rate-limited.
