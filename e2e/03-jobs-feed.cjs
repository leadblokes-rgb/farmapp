const { chromium, launchOptions } = require('./lib.cjs');
const { execSync } = require('child_process');
const OUT = require('./lib.cjs').OUT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sql = (q) => execSync(`psql -tA postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "${q}"`).toString().trim();
const field = (page, label) => page.locator(`input:near(:text("${label}"), 10), textarea:near(:text("${label}"), 10)`).first();
const WORKER = '11111111-1111-1111-1111-111111111111';

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
  const demo = async (role, label) => {
    page = await newPage();
    await page.goto('http://localhost:8081', { timeout: 120000 });
    await page.getByText(role).click({ timeout: 120000 });
    await page.getByText(label, { exact: true }).click();
  };

  // ---------- Farm: jobs list and posting ----------
  await demo("I'm a farm or employer", 'Demo farm (verified)');
  await page.getByText('Lettuce harvest crew').waitFor({ timeout: 30000 });
  await page.getByText('15 applicants').waitFor();
  await page.screenshot({ path: `${OUT}/m3-1-farm-jobs.png` });
  console.log('PASS farm sees seeded jobs with applicant counts');

  await page.getByRole('button', { name: /Post a job/ }).click();
  await page.getByText('The job', { exact: true }).waitFor();
  await page.getByLabel('Job title').fill('Zucchini pickers');
  await page.getByRole('radio', { name: 'Picking' }).click();
  const dates = page.getByPlaceholder('DD/MM/YYYY');
  const d = new Date(); d.setDate(d.getDate() + 10);
  const dd = (x) => String(x).padStart(2, '0');
  await page.getByLabel('Start date').fill(`${dd(d.getDate())}${dd(d.getMonth() + 1)}${d.getFullYear()}`);
  d.setDate(d.getDate() + 40);
  await page.getByLabel('End date').fill(`${dd(d.getDate())}${dd(d.getMonth() + 1)}${d.getFullYear()}`);
  await page.getByLabel('Hourly rate').fill('28');
  await page.getByText(/This hourly rate is below the Horticulture Award casual minimum of \$32\.18\/hr/).waitFor();
  await page.screenshot({ path: `${OUT}/m3-2-award-warning.png`, fullPage: false });
  console.log('PASS below-award warning shown for $28/hr');

  // Full-time / part-time minimum is lower ($25.74, no casual loading).
  await page.getByRole('radio', { name: 'Full-time' }).click();
  await page.getByText(/Minimum \$25\.74\/hr under the Horticulture Award/).waitFor();
  if (await page.getByText(/below the Horticulture Award/).count()) throw new Error('warning shown for $28/hr full-time');
  await page.getByLabel('Hourly rate').fill('25');
  await page.getByText(/below the Horticulture Award full-time minimum of \$25\.74\/hr/).waitFor();
  await page.getByLabel('Hourly rate').fill('28');
  await page.getByRole('radio', { name: 'Casual' }).click();
  console.log('PASS award minimum follows casual / full-time');

  await page.getByRole('button', { name: /Piece rate/ }).click();
  await page.getByLabel('Piece rate', { exact: true }).fill('3.50');
  await page.getByRole('button', { name: /Post job/ }).click();
  await page.getByText('Piece-rate jobs must state the minimum hourly amount you guarantee').waitFor();
  console.log('PASS piece-rate requires a guaranteed hourly minimum');
  await page.getByLabel('Per (bin, tray, kg…)').fill('crate');
  await page.getByLabel('Guaranteed minimum per hour').fill('33');
  await page.getByText('Workers will see: $3.50 per crate, at least $33/hr guaranteed.').waitFor();
  await page.getByText('Accommodation available').click();
  await page.getByRole('button', { name: /Post job/ }).click();
  await page.getByText('0 of 10 filled').waitFor({ timeout: 20000 });
  const posted = sql(`select pay_type||'|'||pay_rate_cents||'|'||piece_rate_unit||'|'||min_hourly_guarantee_cents||'|'||region_id from jobs where title='Zucchini pickers'`);
  if (posted !== 'piece_rate|350|crate|3300|lockyer-valley') throw new Error('bad posted job ' + posted);
  console.log('PASS piece-rate job posted:', posted);

  // Close a seeded job
  await page.goBack();
  await page.getByText('Broccoli packing shed').click();
  await page.getByRole('button', { name: /^Close$/ }).click();
  await page.getByText('Job closed. It no longer shows to workers.').waitFor();
  console.log('PASS farm closed a job');

  // Pending farm cannot post
  await demo("I'm a farm or employer", 'Demo farm (pending)');
  await page.getByText('Waiting for verification').waitFor({ timeout: 30000 });
  const btn = await page.getByRole('button', { name: /Post a job/ }).getAttribute('aria-disabled');
  if (btn !== 'true') throw new Error('pending farm can post');
  console.log('PASS pending farm cannot post jobs');

  // ---------- Worker: swipe feed ----------
  await demo("I'm looking for work", 'Demo worker');
  await page.getByTestId('swipe-card').waitFor({ timeout: 30000 });
  const countText = await page.getByText(/jobs? for you/).textContent();
  const n0 = parseInt(countText);
  await page.screenshot({ path: `${OUT}/m3-3-feed.png` });
  console.log('PASS feed shows', countText);
  if (await page.getByText('Broccoli packing shed').count()) throw new Error('closed job visible in feed');
  const zucchini = await page.evaluate(() => document.body.innerText.includes('Zucchini pickers'));

  const topTitle = async () => (await page.getByTestId('swipe-card').getByTestId('job-title').textContent());
  const t1 = await topTitle();
  await page.getByLabel('Apply for this job').click();
  await page.getByText(`Applied to ${t1}`).waitFor({ timeout: 10000 });
  const apps = sql(`select count(*) from applications a join jobs j on j.id=a.job_id where a.worker_id='${WORKER}' and j.title='${t1.replace(/'/g, "''")}'`);
  if (apps !== '1') throw new Error('application not saved');
  console.log('PASS Apply button ->', t1);

  const t2 = await topTitle();
  await page.getByLabel('Skip this job').click();
  await sleep(800);
  if ((await topTitle()) === t2) throw new Error('skip did not advance');
  await page.getByLabel('Undo last swipe').click();
  await page.getByText('Undone').waitFor();
  await sleep(500);
  if ((await topTitle()) !== t2) throw new Error('undo did not restore card');
  console.log('PASS skip then undo restores', t2);

  // Drag-swipe right with the mouse
  const box = await page.getByTestId('swipe-card').boundingBox();
  const t3 = await topTitle();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(box.x + box.width / 2 + i * 30, box.y + box.height / 2 + i * 2); await sleep(16); }
  await page.mouse.up();
  await page.getByText(`Applied to ${t3}`).waitFor({ timeout: 10000 });
  console.log('PASS drag-swipe right applies ->', t3);

  // Detail sheet
  await page.getByText('Tap for details').click({ force: true });
  await page.getByText(/Why you.re seeing this \(\d+% match\)/).waitFor();
  await page.screenshot({ path: `${OUT}/m3-4-detail.png` });
  await page.getByRole('button', { name: /^Skip$/ }).click();
  console.log('PASS job detail sheet with match explanation');

  // Filters
  await page.getByRole('button', { name: /Filters/ }).click();
  await page.getByText('Only jobs with accommodation').click();
  await page.getByRole('button', { name: /Show jobs/ }).click();
  await sleep(1500);
  const filtered = await page.getByText(/jobs? for you/).textContent();
  const expected = sql(`select count(*) from jobs j join farms f on f.id=j.farm_id where j.status='open' and f.verification_status='verified' and j.accommodation_provided and not exists (select 1 from swipes s where s.job_id=j.id and s.worker_id='${WORKER}')`);
  if (parseInt(filtered) !== parseInt(expected)) throw new Error(`filter count ${filtered} vs db ${expected}`);
  console.log('PASS accommodation filter:', filtered, '(db agrees)');

  // Matches tab + withdraw
  await page.getByRole('tab', { name: /Matches/ }).click();
  await page.getByRole('radio', { name: /Applications/ }).click();
  await page.getByText(t1).waitFor();
  await page.screenshot({ path: `${OUT}/m3-5-applied.png` });
  await page.getByRole('button', { name: /Withdraw application/ }).first().click();
  await page.getByText('Withdrawn').waitFor();
  console.log('PASS applied list and withdraw');

  console.log('INFO new zucchini job visible in first feed page:', zucchini);
  console.log('page errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(async (e) => {
  if (page) await page.screenshot({ path: `${OUT}/m3-fail.png` }).catch(() => {});
  console.error('FAIL', e.message.split('\n').slice(0, 5).join('\n'));
  process.exit(1);
});
