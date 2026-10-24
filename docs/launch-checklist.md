# Croppr: what's left before launch

All six MVP milestones are built and tested locally. This is what remains, roughly in order.
**You** = a decision or account only you can provide. **Dev** = code or config work.

## 1. Try it on real phones (start here)
- [x] **Dev:** `eas.json` build profiles (development, preview, production) and `expo-dev-client`.
- [ ] **You:** Follow [`dev-builds.md`](dev-builds.md): `eas init`, register your iPhone, build and install the development build, and set the two push Vault secrets on hosted Supabase.
- [ ] **You:** Test on real devices outdoors:
  - swipe feel, tap targets in sun or with gloves
  - camera for the photo and payslip
  - "Use my location"
  - push notifications (these can't be tested in Expo Go on Android)
- [ ] **Dev:** Fix whatever that turns up. Web testing is done; the native gesture and camera paths haven't been tried on a device yet.

## 2. Confirm the rules (needs an expert)
- [ ] **You:** Have a registered migration agent check `packages/shared/src/config/visaRules.ts`. Current choices:
  - a week of 35+ hours over at least 5 days counts as 7 days
  - a shift of 7+ hours counts as one day
  - shorter shifts are ignored
  - each calendar day counts once
  - dates after today never count
  - a part-time payslip counts only the days its hours support (e.g. 5 days but 12 hours = 1 day)
  
  Public guidance disagrees on part-time counting.
- [ ] **You:** Diarise a review of `packages/shared/src/config/payRules.ts` every July (from 1 July 2026: $32.18/hr casual, $25.74/hr part-time and full-time, Level 1 adult, per the Fair Work Horticulture Showcase).
- [x] **Dev:** Eligible specified-work postcode lists (plant & animal cultivation) in the database, with version, last-checked date and source; updated from the dashboard (`docs/admin-runbook.md`).
- [ ] **You:** Have the migration agent check that postcode list against the current Home Affairs instrument (F2022L00271 / LIN 22/037). It was compiled from secondary sources because the official site couldn't be reached from the build environment.
- [ ] **You:** Get legal advice on whether Croppr itself needs a labour hire licence in QLD or other states. A job platform usually doesn't, but check.

## 3. Legal and privacy (required by the app stores and the Privacy Act)
- [ ] **You:** Have an Australian lawyer review the draft privacy policy and terms (`docs/legal/`). Croppr holds sensitive information (visa status, nationality, payslips), so the Australian Privacy Principles apply. Then set `draft: false` and bump the versions in `packages/shared/src/config/legal.ts`.
- [x] **Dev:** A consent step at sign-up linking those documents, and links in Profile.
- [x] **Dev:** "Contact support" links in Profile and on the suspended screen.
- [ ] **You:** Set up a monitored support inbox and put its address in `legal.supportEmail` (currently `support@croppr.com.au`, a placeholder).
- [ ] **You:** Decide how long data is kept (e.g. closed jobs, old chats, payslips) and whether to auto-delete it.
- [ ] **You:** Fill in the App Store privacy labels and the Google Play data safety form.

## 4. Production backend
- [ ] **You:** Create a Supabase project in the **Sydney (ap-southeast-2)** region, so data stays in Australia, on a paid plan for backups.
- [ ] **Dev:** Set up production:
  1. `supabase link` and `supabase db push`
  2. deploy both Edge Functions
  3. set the two Vault secrets (see the README)
  4. set the auth email templates to show the 6-digit code
  5. connect a real email provider (e.g. Resend or Postmark)
- [ ] **Dev:** Load the full Australian postcode list. Right now only about 20 QLD postcodes exist, so distance ranking only works there.
- [ ] **Dev:** Create the first admin account and walk through `docs/admin-runbook.md` with whoever will approve farms.

## 4b. Charging (decided: farms pay $39 per accepted worker)
- [x] **Dev:** Chat contact filter: contact details are hidden until a farm accepts a worker; repeat attempts are listed for admins.
- [ ] **Dev:** Payments: charge the $39 at acceptance (Stripe), refund undisputed no-shows, and add a per-job cap and season pass if wanted. Workers are never charged.
- [ ] **You:** Register for GST before charging; Stripe issues the tax invoices.
- [ ] **You:** Add a non-circumvention clause to the terms in the legal review (hiring someone met on Croppr outside the app within 6 months still owes the fee).

## 5. App store release
- [ ] **You:** Apple Developer account (paid yearly) and Google Play Console account (one-off fee), under the business name.
- [ ] **You:** Store listing: screenshots, description, keywords, support URL, privacy policy URL. The app icon and splash are done from the Croppr logo.
- [ ] **Dev:** Production builds with `eas build`, then TestFlight and Play internal testing, then submit.

## 6. Running it
- [ ] **Dev:** Crash and error reporting (e.g. Sentry) for the app and the Edge Functions.
- [ ] **Dev:** A GitHub Actions workflow that runs typecheck, lint, unit tests and the database tests on every push.
- [ ] **Dev:** Basic usage stats for the team: signups, jobs posted, applications, hires per week. A dashboard in Supabase or a few saved SQL queries are enough at first.
- [ ] **Dev:** Rate limits on messages, reports and sign-in codes, to stop spam.

## 7. After the MVP (agreed to defer)
- A dedicated admin web app (farm queue, reports, stats) to replace the dashboard SQL.
- Automatic ABN checks through the ABR web service, and checks against labour hire registers.
- Translations: many workers aren't native English speakers. French, German, Korean, Japanese, Spanish and Chinese would cover most of them.
- A smarter, AI-based ranker: implement the `Ranker` interface in `packages/matching`.
