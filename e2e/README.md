# Browser end-to-end tests

These tests use Playwright to drive the Expo **web** build against local Supabase. Each suite covers one milestone's flows: sign-in, onboarding, posting jobs, swiping, the shortlist, chat, and the day tracker.

```bash
npm run db:start
cd apps/mobile && npx expo start --web --port 8081   # in another terminal
npm i -D playwright && npx playwright install chromium   # once
npm run test:e2e
```

Each suite resets the database first. Failure screenshots go to `e2e/screenshots/`, which git ignores.

Swipe gestures, the camera and push notifications behave differently on a real phone, so also do a manual pass on a device before releases.
