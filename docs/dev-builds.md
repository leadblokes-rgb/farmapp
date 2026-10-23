# Croppr on your iPhone: development builds

Expo Go is fine for most testing, but it can't do everything. A **development build** is your own copy of the Croppr app, installed on your iPhone. It's needed for:

- push notifications (new applicant, accepted, new message)
- the native calendar date picker and camera, exactly as users will get them
- testing with real farms before the App Store release

Once it's installed, you still run `npx expo start` on your computer as usual, and the app loads your latest code over Wi-Fi. You only rebuild when native settings change (I'll tell you when).

## What you need

- An **Expo account** (free): https://expo.dev/signup
- An **Apple Developer account** ($149 AUD/year): https://developer.apple.com/programs/enroll/. Enrolment can take a day or two.
- Your iPhone, with **Developer Mode** on. You'll be asked to turn it on after installing; see step 6.

## Steps (Windows PowerShell)

Run each line on its own, from the `apps\mobile` folder of the project.

### 1. Go to the app folder

```powershell
cd apps\mobile
```

### 2. Log in to Expo

```powershell
npx eas-cli login
```

### 3. Link the project to your Expo account (once)

```powershell
npx eas-cli init
```

Say **yes** when it asks to create a project. It adds a `projectId` to `app.json`. Commit that change; push notifications need it.

### 4. Register your iPhone (once per phone)

```powershell
npx eas-cli device:create
```

Choose **Website**. It shows a QR code: scan it with the iPhone camera, then install the profile it offers (Settings → Profile Downloaded → Install).

### 5. Build

```powershell
npx eas-cli build --profile development --platform ios
```

- Log in with your Apple ID when asked, and let EAS create the certificates and **push notification key** for you (answer yes to each).
- The build runs on Expo's servers and takes about 15–25 minutes. You can close the window; you'll get an email.

### 6. Install it

When the build finishes, open the link it shows (or the email) **on the iPhone** and tap **Install**.

The first time, iOS asks you to turn on Developer Mode: Settings → Privacy & Security → Developer Mode → On, then restart the phone.

### 7. Run Croppr

On your computer:

```powershell
npx expo start --dev-client
```

Open **Croppr** on the iPhone (not Expo Go). It finds your computer on the same Wi-Fi, or scan the QR code with the iPhone camera.

## Push notifications on hosted Supabase

The database needs two secrets to send pushes. In the Supabase dashboard → **SQL Editor**, run these two lines once, replacing the parts in `< >`:

```sql
select vault.create_secret('https://dfvewxxusinoewczeftk.supabase.co/functions/v1', 'functions_url');
select vault.create_secret('<service_role key>', 'service_role_key');
```

- Find the **service_role** key under Project Settings → API Keys. It's secret: paste it only into the Supabase SQL editor, never into chat, email or the code.
- Also deploy the push function if you haven't: `npx supabase functions deploy send-push --no-verify-jwt --use-api` (run from the repo root).

To check pushes are going out, run `select * from notification_log order by id desc limit 20;` in the SQL editor.

## Builds for other testers (later)

A **preview** build is a normal app (no computer needed) you can share with real farms and workers:

1. Register each tester's iPhone with `npx eas-cli device:create`.
2. The app needs the Supabase URL and key built in. Set them once:
   ```powershell
   npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://dfvewxxusinoewczeftk.supabase.co --environment preview --visibility plaintext
   ```
   ```powershell
   npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_KEY --value <publishable key> --environment preview --visibility plaintext
   ```
   The publishable key is meant to be public (it's inside every copy of the app). Never use the service_role key here.
3. Build:
   ```powershell
   npx eas-cli build --profile preview --platform ios
   ```

For the App Store and Google Play, the `production` profile does the same with store signing. That's covered in the launch checklist.

## Good to know

- **Demo sign-in buttons** only appear when `EXPO_PUBLIC_SHOW_DEMO_ACCOUNTS=true` is in `apps/mobile/.env.local`. Turn it off (`false`) before showing the app to real farms.
- Android works the same way: use `--platform android` and install the `.apk` link. No Apple account or device registration needed.
- If the app can't reach your computer, check both are on the same Wi-Fi, or run `npx expo start --dev-client --tunnel`.
