const { chromium, launchOptions } = require('./lib.cjs');
const { execSync } = require('child_process');
const OUT = require('./lib.cjs').OUT;
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
const LETTUCE = 'a0000000-0000-0000-0000-000000000001';

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

  // ---------- Farm shortlist ----------
  page = await newPage();
  await page.goto('http://localhost:8081', { timeout: 120000 });
  await page.getByText("I'm a farm or employer").click({ timeout: 120000 });
  await page.getByText('Demo farm (verified)', { exact: true }).click();
  await page.getByText('Lettuce harvest crew').click({ timeout: 30000 });
  await page.getByText('0 of 30 filled').waitFor({ timeout: 30000 });
  await page.getByText('To review (15)').waitFor();
  const scored = sql(`select count(*) from applications where job_id='${LETTUCE}' and match_score is not null`);
  if (scored !== '15') throw new Error('scores not stored: ' + scored);
  console.log('PASS shortlist ranked server-side (15 scored)');

  // Ordered by score (group members pulled together)
  const top = sql(`select wp.full_name from applications a join worker_profiles wp on wp.user_id=a.worker_id where job_id='${LETTUCE}' order by match_score desc limit 1`);
  const firstCardName = await page.locator('[aria-label^="Select "]').first().getAttribute('aria-label');
  if (firstCardName !== `Select ${top}`) throw new Error(`first card ${firstCardName} vs top ${top}`);
  console.log('PASS highest score first:', top);

  await page.getByText(/Group of 3 · with/).first().waitFor();
  await page.getByText('visa ends before job end').first().waitFor();
  await page.screenshot({ path: `${OUT}/m4-1-shortlist.png` });
  console.log('PASS group note and visa warning shown');

  // Select whole group -> accept
  await page.getByRole('button', { name: /Select whole group/ }).first().click();
  await page.getByRole('button', { name: /Accept 3/ }).click();
  await page.getByText('Accept 3 applicants?').waitFor();
  await page.getByText('That makes 3 of 30 filled.', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Accept', exact: true }).click();
  await page.getByText('Accepted 3 applicants').waitFor();
  await page.getByText('3 of 30 filled').waitFor();
  const groupAccepted = sql(`select count(*) from applications a join worker_profiles wp on wp.user_id=a.worker_id where job_id='${LETTUCE}' and a.status='accepted' and wp.group_id is not null`);
  if (groupAccepted !== '3') throw new Error('group not accepted');
  console.log('PASS select whole group + bulk accept (3 of 30 filled)');

  // Bulk: select all remaining and decline 2 individually
  const checks = page.locator('[aria-label^="Select "]');
  await checks.nth(0).click();
  await checks.nth(1).click();
  await page.getByRole('button', { name: /Decline 2/ }).click();
  await page.getByRole('button', { name: 'Decline', exact: true }).click();
  await page.getByText('Declined 2 applicants').waitFor();
  await page.getByText('Declined (2)').waitFor();
  console.log('PASS bulk decline 2');

  // Select all + accept
  await page.getByRole('button', { name: /Select all/ }).click();
  await page.getByRole('button', { name: /Accept 10/ }).click();
  await page.getByRole('button', { name: 'Accept', exact: true }).click();
  await page.getByText('13 of 30 filled').waitFor();
  console.log('PASS select all + accept 10 (13 of 30 filled)');

  // Applicant detail from accepted tab
  await page.getByRole('radio', { name: /Accepted \(13\)/ }).click();
  await page.locator('[aria-label^="Select "]').first().waitFor();
  const firstName = (await page.locator('[aria-label^="Select "]').first().getAttribute('aria-label')).replace('Select ', '');
  await page.getByText(firstName, { exact: true }).last().click({ force: true });
  await page.getByText(/Match score \d+\/100/).waitFor({ timeout: 15000 });
  await page.getByText('Availability', { exact: true }).waitFor();
  await page.screenshot({ path: `${OUT}/m4-2-applicant.png` });
  await page.getByRole('button', { name: /No longer coming: decline/ }).click();
  await page.getByText('Status: declined').waitFor();
  console.log('PASS applicant detail with score breakdown; accepted -> declined');

  // Shortlist access for another farm via direct API is covered by pgTAP + function 403.

  // ---------- Worker sees acceptance ----------
  page = await newPage();
  const wEmail = 'worker3@demo.croppr.test';
  await page.goto('http://localhost:8081', { timeout: 120000 });
  await page.getByText("I'm looking for work").click({ timeout: 120000 });
  await page.locator('input[type="email"]').fill(wEmail);
  await page.getByText('Email me a code').click();
  await page.locator('input[autocomplete="one-time-code"]').fill(await latestCode(wEmail));
  await page.getByRole('tab', { name: /Matches/ }).click({ timeout: 30000 });
  await page.getByRole('radio', { name: /Applications/ }).click();
  await page.getByText('Accepted 🎉').first().waitFor({ timeout: 15000 });
  console.log('PASS worker sees "Accepted"');

  // Group card: worker3 is in the FRANCE group
  await page.getByRole('tab', { name: /Profile/ }).click();
  await page.getByText('Group code:').waitFor({ timeout: 15000 });
  await page.getByText('FRANCE', { exact: true }).waitFor();
  await page.screenshot({ path: `${OUT}/m4-3-group.png` });
  await page.getByRole('button', { name: /Leave group/ }).click();
  await page.getByRole('button', { name: /Create a group/ }).waitFor();
  await page.getByRole('button', { name: /Create a group/ }).click();
  await page.getByText('Group code:').waitFor();
  const newCode = sql(`select g.invite_code from worker_groups g join worker_profiles wp on wp.group_id=g.id where wp.user_id='11111111-0000-0000-0000-000000000003'`);
  if (!/^[0-9A-F]{6}$/.test(newCode)) throw new Error('bad code ' + newCode);
  console.log('PASS group leave + create, new code', newCode);

  console.log('page errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(async (e) => {
  if (page) await page.screenshot({ path: `${OUT}/m4-fail.png` }).catch(() => {});
  console.error('FAIL', e.message.split('\n').slice(0, 5).join('\n'));
  process.exit(1);
});
