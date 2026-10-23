// Terms and privacy consent after sign-in, re-prompt on a new version, and legal links in Profile.
const { chromium, launchOptions } = require('./lib.cjs');
const { execSync } = require('child_process');
const OUT = require('./lib.cjs').OUT;
const sql = (q) => execSync(`psql -tA postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "${q}"`).toString().trim();
const NEW_USER = '33333333-3333-3333-3333-333333333333';

let page;
(async () => {
  const browser = await chromium.launch(launchOptions);
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));

  // ---------- New user must accept before choosing a role ----------
  await page.goto('http://localhost:8081', { timeout: 120000 });
  await page.getByText("I'm looking for work").click({ timeout: 120000 });
  await page.getByText('Demo new user (no role)', { exact: true }).click();
  await page.getByText('Before you start').waitFor({ timeout: 30000 });
  const cont = page.getByRole('button', { name: 'Continue' });
  if (!(await cont.isDisabled())) throw new Error('Continue enabled before agreeing');
  await page.screenshot({ path: `${OUT}/e-1-consent.png` });

  await page.getByRole('button', { name: /Read: Privacy policy/ }).click();
  await page.getByText(/Who can see what/).waitFor({ timeout: 15000 });
  await page.screenshot({ path: `${OUT}/e-2-privacy.png` });
  await page.goBack();
  await page.getByText('Before you start').waitFor({ timeout: 15000 });

  await page.getByLabel('I agree to the Terms of use').click();
  await page.getByLabel('I’ve read the Privacy policy').click();
  await cont.click();
  await page.getByText('How will you use Croppr?').waitFor({ timeout: 20000 });
  const accepted = sql(`select terms_version || '|' || privacy_version || '|' || (terms_accepted_at is not null) from profiles where id='${NEW_USER}'`);
  if (accepted !== '2026-10-draft-1|2026-10-draft-1|true') throw new Error('consent not stored: ' + accepted);
  console.log('PASS new user accepts terms and privacy before choosing a role');

  // ---------- A new version asks again ----------
  sql(`update profiles set terms_version = '2025-old' where id='${NEW_USER}'`);
  await page.reload();
  await page.getByText('We’ve updated our terms').waitFor({ timeout: 60000 });
  console.log('PASS an updated version asks again');
  await page.getByRole('button', { name: 'Sign out' }).click();

  // ---------- Legal links in Profile ----------
  await page.getByText("I'm looking for work").click({ timeout: 60000 });
  await page.getByText('Demo worker', { exact: true }).click();
  await page.getByRole('tab', { name: /Profile/ }).click({ timeout: 30000 });
  await page.getByText('Privacy, terms and support').scrollIntoViewIfNeeded();
  await page.getByText(/Contact support \(/).waitFor();
  await page.getByRole('button', { name: 'Terms of use' }).click();
  await page.getByText(/Croppr is not the employer/).waitFor({ timeout: 15000 });
  console.log('PASS Profile links to the terms, privacy policy and support');

  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
  console.log('page errors: none');
  await browser.close();
})().catch(async (e) => {
  console.log('FAIL', e.message);
  if (page) await page.screenshot({ path: `${OUT}/e-fail.png` }).catch(() => {});
  process.exit(1);
});
