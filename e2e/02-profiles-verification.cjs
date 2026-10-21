const { chromium, launchOptions } = require('./lib.cjs');
const { execSync } = require('child_process');
const OUT = require('./lib.cjs').OUT;
function randomAbn() {
  const W = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const base = String(Math.floor(Math.random() * 1e9)).padStart(9, '0');
  for (let p = 10; p <= 99; p++) {
    const d = (String(p) + base).split('').map(Number); d[0] -= 1;
    if (d.reduce((a, x, i) => a + x * W[i], 0) % 89 === 0) return String(p) + base;
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sql = (q) => execSync(`psql -tA postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "${q}"`).toString().trim();

async function latestCode(email) {
  for (let i = 0; i < 20; i++) {
    const { messages } = await (await fetch('http://127.0.0.1:54324/api/v1/messages')).json();
    const m = messages.find((m) => m.To.some((t) => t.Address === email));
    if (m) return m.Snippet.match(/\b(\d{6})\b/)[1];
    await sleep(500);
  }
  throw new Error('no email for ' + email);
}

async function otpSignIn(page, roleButton, email) {
  await page.goto('http://localhost:8081', { timeout: 120000 });
  await page.getByText(roleButton).click({ timeout: 120000 });
  await page.locator('input[type="email"]').fill(email);
  await page.getByText('Email me a code').click();
  await page.getByText('Check your email').waitFor();
  await page.locator('input[autocomplete="one-time-code"]').fill(await latestCode(email));
}

// Fill the Paper TextInput whose label text matches.
const field = (page, label) => page.locator(`input:near(:text("${label}"), 10), textarea:near(:text("${label}"), 10)`).first();

let page;
(async () => {
  const browser = await chromium.launch(launchOptions);
  const errors = [];
  const newPage = async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    return p;
  };

  // ---------- Worker onboarding ----------
  page = await newPage();
  const wEmail = `w${Date.now()}@test.local`;
  await otpSignIn(page, "I'm looking for work", wEmail);
  await page.getByText('Set up your profile').waitFor({ timeout: 20000 });
  await page.getByText('Save and start finding work').click();
  await page.getByText('Please fix the highlighted fields above.').waitFor();
  await page.getByText('Pick at least one region').waitFor();
  await page.screenshot({ path: `${OUT}/m2-1-worker-errors.png`, fullPage: true });
  console.log('PASS worker form shows validation errors');

  await page.getByLabel('Full name').fill('Jess Walker').catch(async () => field(page, 'Full name').fill('Jess Walker'));
  await page.getByText('Choose…').click();
  await page.getByPlaceholder('Search').fill('irel');
  await page.getByText('Ireland', { exact: true }).click();
  await page.getByRole('radio', { name: 'Working Holiday (417)' }).click();
  await page.getByPlaceholder('DD/MM/YYYY').first().fill('30062028');
  await page.locator('input[maxlength="4"]').first().fill('4343');
  await page.getByText('Gatton, QLD').waitFor();
  await page.getByText('Lockyer Valley', { exact: true }).click();
  await page.getByText('Bundaberg & Wide Bay').click();
  const dates = page.getByPlaceholder('DD/MM/YYYY');
  await dates.nth(1).fill('01122027');
  await dates.nth(2).fill('28022028');
  await page.getByText('I have a car').click();
  await page.getByText('With a group').click();
  await page.getByLabel('Increase People in your group (incl. you)').click();
  await page.getByLabel('Increase Seasons of farm work').click();
  await page.getByText('Fruit & veg picking').click();
  await page.screenshot({ path: `${OUT}/m2-2-worker-filled.png`, fullPage: true });
  await page.getByText('Save and start finding work').click();
  await page.getByText(/jobs? for you|Finding jobs|all caught up/).waitFor({ timeout: 20000 });
  console.log('PASS worker onboarding saved -> Discover');

  const row = sql(`select wp.full_name||'|'||wp.group_size||'|'||wp.has_car||'|'||wpr.nationality||'|'||wpr.visa_expiry||'|'||(select count(*) from worker_regions r where r.worker_id=wp.user_id)||'|'||(select min(start_date) from worker_availability a where a.worker_id=wp.user_id) from worker_profiles wp join worker_private wpr using (user_id) join auth.users u on u.id=wp.user_id where u.email='${wEmail}'`);
  if (row !== 'Jess Walker|3|true|IE|2028-06-30|2|2027-12-01') throw new Error('unexpected DB row ' + row);
  console.log('PASS DB row correct:', row);

  await page.getByRole('tab', { name: /Profile/ }).click();
  await page.locator('input[value="Jess Walker"]').waitFor();
  await page.screenshot({ path: `${OUT}/m2-3-worker-profile.png`, fullPage: true });
  await page.locator('input[value="Jess Walker"]').fill('Jess W. Walker');
  await page.getByText('Save changes').click();
  await page.getByText('Profile saved').waitFor();
  console.log('PASS profile edit saved');

  // Delete account
  await page.getByText('Delete my account').click();
  await page.getByText('Delete your account?').waitFor();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByText("I'm looking for work").waitFor({ timeout: 15000 });
  const left = sql(`select count(*) from auth.users where email='${wEmail}'`);
  if (left !== '0') throw new Error('user not deleted');
  console.log('PASS account deleted');

  // ---------- Farm signup ----------
  page = await newPage();
  const fEmail = `f${Date.now()}@test.local`;
  await otpSignIn(page, "I'm a farm or employer", fEmail);
  await page.getByText('Register your business').waitFor({ timeout: 20000 });
  await field(page, 'Business or trading name').fill('Sunny Hill Strawberries');
  await page.locator('input[maxlength="14"]').fill('51 824 753 557');
  await page.getByText('We are a labour hire provider').click();
  await page.locator('input[type="tel"]').fill('0412 345 678');
  await page.locator('input[maxlength="4"]').fill('4670');
  await page.getByText('Submit for verification').click();
  await page.getByText('That ABN doesn’t look right. Check the 11 digits.').waitFor();
  await page.getByText('Labour hire providers must enter their licence number').waitFor();
  await page.screenshot({ path: `${OUT}/m2-4-farm-errors.png`, fullPage: true });
  console.log('PASS farm form validation (ABN checksum, licence required)');
  await page.locator('input[maxlength="14"]').fill(randomAbn());
  await page.getByText('✓ ABN format looks right').waitFor();
  await field(page, 'Labour hire licence number').fill('LHL09999');
  await page.getByText('Submit for verification').click();
  await page.getByText('Waiting for verification').waitFor({ timeout: 20000 });
  if ((await page.getByRole('button', { name: /Post a job/ }).getAttribute('aria-disabled')) !== 'true') throw new Error('Post a job should be disabled while pending');
  await page.screenshot({ path: `${OUT}/m2-5-farm-pending.png` });
  console.log('PASS farm submitted -> pending, posting disabled');

  // Admin approves from "dashboard"
  const farmId = sql(`select f.id from farms f join auth.users u on u.id=f.owner_id where u.email='${fEmail}'`);
  sql(`select admin_approve_farm('${farmId}', 'e2e')`);
  await page.reload();
  await page.getByRole('tab', { name: /Farm/ }).click({ timeout: 20000 });
  await page.getByText('is verified').waitFor({ timeout: 20000 });
  await page.getByRole('tab', { name: /Jobs/ }).click();
  await page.getByRole('button', { name: /Post a job/ }).click();
  await page.getByText('The job', { exact: true }).waitFor();
  await page.screenshot({ path: `${OUT}/m2-6-farm-verified.png` });
  console.log('PASS admin approval -> Verified badge, posting enabled');

  // ---------- Rejected demo farm resubmits ----------
  page = await newPage();
  await page.goto('http://localhost:8081', { timeout: 120000 });
  await page.getByText("I'm a farm or employer").click();
  await page.locator('input[type="email"]').fill('rejected-farm@demo.croppr.test');
  await page.evaluate(() => 0);
  // Use password login through the dev button list isn't available for this account, so sign in via API session injection is overkill; use OTP.
  await page.getByText('Email me a code').click();
  await page.getByText('Check your email').waitFor();
  await page.locator('input[autocomplete="one-time-code"]').fill(await latestCode('rejected-farm@demo.croppr.test'));
  await page.getByText('Verification unsuccessful').waitFor({ timeout: 20000 });
  await page.getByText("The business name doesn't match").waitFor();
  await page.screenshot({ path: `${OUT}/m2-7-farm-rejected.png` });
  await page.getByRole('tab', { name: /Farm/ }).click();
  await page.getByText('Save and resubmit').click();
  await page.getByText('Farm details saved').waitFor();
  await page.getByText('Waiting for verification').first().waitFor();
  console.log('PASS rejected farm resubmits -> pending');

  // ---------- Seeded worker goes straight to tabs ----------
  page = await newPage();
  await page.goto('http://localhost:8081', { timeout: 120000 });
  await page.getByText("I'm looking for work").click();
  await page.getByText('Demo worker').click();
  await page.getByText(/jobs? for you|Finding jobs|all caught up/).waitFor({ timeout: 20000 });
  await page.getByRole('tab', { name: /Profile/ }).click();
  await page.locator('input[value="Sam Taylor"]').waitFor({ timeout: 15000 });
  console.log('PASS seeded worker is onboarded and profile loads');

  console.log('page errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(async (e) => {
  if (page) await page.screenshot({ path: `${OUT}/m2-fail.png`, fullPage: true }).catch(() => {}); console.error('FAIL', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
