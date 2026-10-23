// Regression tests for the v1.1 bug fixes: Regions filter, toast placement, skeletons, date limits,
// day-tracker validation and the replace-shift confirmation.
const { chromium, launchOptions } = require('./lib.cjs');
const { execSync } = require('child_process');
const OUT = require('./lib.cjs').OUT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sql = (q) => execSync(`psql -tA postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "${q}"`).toString().trim();
const SAM = '11111111-1111-1111-1111-111111111111';

const ddmmyyyy = (offsetDays) => {
  const d = new Date();
  d.setHours(12);
  d.setDate(d.getDate() + offsetDays);
  return `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`;
};

let page;
(async () => {
  const browser = await chromium.launch(launchOptions);
  const errors = [];
  const open = async (role, label, width = 390, height = 844) => {
    const ctx = await browser.newContext({ viewport: { width, height } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto('http://localhost:8081', { timeout: 120000 });
    await p.getByText(role).click({ timeout: 120000 });
    await p.getByText(label, { exact: true }).click();
    return p;
  };

  // ---------- Regions: the filter always lists every region ----------
  page = await open("I'm looking for work", 'Demo worker');
  await page.getByTestId('swipe-card').waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: /Filters/ }).click();
  await page.getByText('Regions', { exact: true }).waitFor();
  const names = sql("select string_agg(name, '|') from regions").split('|');
  const regionCount = names.length;
  await page.getByText(names[0], { exact: true }).waitFor({ timeout: 15000 });
  let shown = 0;
  for (const n of names) if (await page.getByText(n, { exact: true }).count()) shown++;
  if (shown !== regionCount) throw new Error(`expected ${regionCount} regions in Filters, saw ${shown}`);
  console.log(`PASS Filters lists all ${regionCount} regions`);

  // "To" can't be before "From"
  await page.getByLabel('From', { exact: true }).fill(ddmmyyyy(10));
  await page.getByLabel('To', { exact: true }).fill(ddmmyyyy(5));
  await page.getByText(/or later$/).waitFor();
  console.log('PASS date range: "To" before "From" is flagged');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Cancel|Close/ }).first().click().catch(() => {});

  // ---------- Days: skeleton while loading ----------
  await page.route('**/rest/v1/shift_logs*', async (route) => {
    await sleep(2000);
    await route.continue().catch(() => {});
  });
  await page.reload();
  await page.getByRole('tab', { name: /Days/ }).click({ timeout: 60000 });
  await page.getByLabel('Loading your days').waitFor({ timeout: 5000 });
  await page.screenshot({ path: `${OUT}/v11-1-days-skeleton.png` });
  console.log('PASS Days shows a skeleton while loading');
  await page.unroute('**/rest/v1/shift_logs*');
  await page.getByText(/Estimate only, not immigration advice/).waitFor({ timeout: 20000 });

  // ---------- Shift: no future dates; replacing asks first ----------
  const sunny = 'Sunny Strawberries (Caboolture)';
  await page.getByRole('button', { name: /Log a shift/ }).click();
  await page.getByRole('radio', { name: sunny }).click();
  await page.getByLabel('Date').fill(ddmmyyyy(3));
  await page.getByText(/or earlier$/).waitFor();
  console.log('PASS future shift date is flagged');

  // A day already logged at Sunny (Monday, five weeks ago, from the seed)
  const seeded = sql(`select to_char(min(work_date), 'DDMMYYYY') || '|' || min(work_date) from shift_logs where worker_id='${SAM}' and employer_id='e1000000-0000-0000-0000-000000000001'`);
  const [seededText, seededIso] = seeded.split('|');
  await page.getByLabel('Date').fill(seededText);
  await page.getByRole('button', { name: /Save shift/ }).click();
  await page.getByText(/You already logged 8h at Sunny Strawberries/).waitFor();
  await page.screenshot({ path: `${OUT}/v11-2-replace-shift.png` });
  const before = sql(`select hours from shift_logs where employer_id='e1000000-0000-0000-0000-000000000001' and work_date='${seededIso}'`);
  if (Number(before) !== 8) throw new Error('shift changed before confirming: ' + before);
  await page.getByRole('button', { name: /Replace with/ }).click();
  await page.getByText('Shift saved').waitFor();
  console.log('PASS saving over an existing shift asks before replacing');

  // ---------- Payslip: implausible hours are rejected with a clear message ----------
  await page.getByRole('button', { name: /Add a payslip/ }).click();
  await page.getByText('Copy the details from your payslip').waitFor();
  await page.getByRole('radio', { name: sunny }).click();
  await page.getByLabel('Period start').fill(ddmmyyyy(-20));
  await page.getByLabel('Period end').fill(ddmmyyyy(-7));
  // The stepper starts at 5 days; 5 days × 16h = 80h, so 100h is implausible.
  await page.getByLabel('Total hours').fill('100');
  await page.getByRole('button', { name: /Save payslip/ }).click();
  await page.getByText(/more than 16 per day worked/).waitFor();
  console.log('PASS payslip with more than 16h per day worked is rejected');

  // The database enforces the same rules, whatever the app sends.
  let dbRejected = false;
  try {
    execSync(
      `psql -v ON_ERROR_STOP=1 -tA postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "insert into shift_logs (worker_id, employer_id, work_date, hours) values ('${SAM}', 'e1000000-0000-0000-0000-000000000001', current_date + 5, 8)"`,
      { stdio: 'ignore' },
    );
  } catch {
    dbRejected = true;
  }
  if (!dbRejected) throw new Error('database accepted a future shift');
  console.log('PASS database rejects future shifts');
  await page.goBack();

  // ---------- Toast sits above the chat composer ----------
  await page.getByRole('tab', { name: /Matches/ }).click();
  await page.getByLabel(/Chat with Lockyer Fresh Farms/).click();
  await page.getByLabel('Message', { exact: true }).waitFor({ timeout: 15000 });
  await page.getByLabel('Report').click();
  await page.getByRole('radio', { name: 'Underpaid / not paid' }).click();
  await page.getByLabel('What happened?').fill('Toast position test');
  await page.getByRole('button', { name: 'Send report' }).click();
  const toast = page.getByText('Thanks. The Croppr team will review your report.');
  await toast.waitFor();
  await sleep(400);
  const toastBox = await toast.boundingBox();
  const composerBox = await page.getByLabel('Message', { exact: true }).boundingBox();
  if (toastBox.y + toastBox.height > composerBox.y) {
    throw new Error(`toast (bottom ${toastBox.y + toastBox.height}) covers the composer (top ${composerBox.y})`);
  }
  await page.screenshot({ path: `${OUT}/v11-3-toast-chat.png` });
  console.log('PASS toast appears above the chat composer');

  // ---------- Small phone (320×568): job card facts aren't cut off mid-line ----------
  const narrow = await open("I'm looking for work", 'Demo worker', 320, 568);
  await narrow.getByTestId('swipe-card').waitFor({ timeout: 30000 });
  await narrow.screenshot({ path: `${OUT}/v11-4-card-320x568.png` });
  const clipped = await narrow.getByTestId('swipe-card').evaluate((card) =>
    [...card.querySelectorAll('div[dir="auto"]')].some(
      (el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).textOverflow === 'ellipsis',
    ),
  );
  if (clipped) throw new Error('job card text is truncated at 320px');
  console.log('PASS job card text fits at 320px');

  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
  console.log('page errors: none');
  await browser.close();
})().catch(async (e) => {
  console.log('FAIL', e.message);
  if (page) await page.screenshot({ path: `${OUT}/v11-fail.png` }).catch(() => {});
  process.exit(1);
});
