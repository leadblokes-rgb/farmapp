const { chromium, launchOptions } = require('./lib.cjs');
const { execSync } = require('child_process');
const OUT = require('./lib.cjs').OUT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sql = (q) => execSync(`psql -tA postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "${q}"`).toString().trim();
const SAM = '11111111-1111-1111-1111-111111111111';
const total = async (page) => parseInt(await page.getByLabel(/ of \d+ days, estimated/).getAttribute('aria-label'));

// Last week's Monday/Sunday as DDMMYYYY for the payslip period.
const d = new Date(); d.setHours(12);
const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7);
const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
const fmt = (x) => `${String(x.getDate()).padStart(2, '0')}${String(x.getMonth() + 1).padStart(2, '0')}${x.getFullYear()}`;

let page;
(async () => {
  const browser = await chromium.launch(launchOptions);
  const errors = [];
  page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:8081', { timeout: 120000 });
  await page.getByText("I'm looking for work").click({ timeout: 120000 });
  await page.getByText('Demo worker', { exact: true }).click();
  await page.getByRole('tab', { name: /Days/ }).click({ timeout: 30000 });

  await page.getByText(/Estimate only, not immigration advice/).waitFor({ timeout: 20000 });
  const t0 = await total(page);
  if (t0 !== 35) throw new Error('expected seeded estimate 35, got ' + t0);
  await page.getByText('Not specified work (not counted)').waitFor();
  await page.screenshot({ path: `${OUT}/m6-1-days.png` });
  console.log('PASS disclaimer shown; seeded estimate is 35 of 88 (3 full-time weeks + full-time payslip; cafe excluded)');

  // Suggestion from the accepted job
  await page.getByRole('button', { name: /Add Lockyer Fresh Farms/ }).click();
  await page.getByText('Added Lockyer Fresh Farms').waitFor();
  console.log('PASS add employer from accepted job');

  // Log today's shift (8h) at Lockyer
  await page.getByRole('button', { name: /Log a shift/ }).click();
  await page.getByRole('radio', { name: 'Lockyer Fresh Farms' }).click();
  await page.getByRole('button', { name: /Save shift/ }).click();
  await page.getByText('Shift saved').waitFor();
  await sleep(800);
  const t1 = await total(page);
  if (t1 !== t0 + 1) throw new Error(`expected ${t0 + 1} after logging today, got ${t1}`);
  console.log('PASS logging an 8h shift today adds 1 day ->', t1);

  // Goal switch
  await page.getByRole('radio', { name: /3rd visa: 179 days/ }).click();
  await page.getByText('of 179 days (estimate)').waitFor();
  const goal = sql(`select tracker_goal from worker_private where user_id='${SAM}'`);
  if (goal !== 'third') throw new Error('goal not saved');
  console.log('PASS goal switched to 179 days (saved)');

  // Payslip with an attached image, full-time week last week -> +7 days
  await page.getByRole('button', { name: /Add a payslip/ }).click();
  await page.getByText('Copy the details from your payslip').waitFor();
  await page.getByRole('radio', { name: 'Lockyer Fresh Farms' }).click();
  await page.getByLabel('Period start').fill(fmt(mon));
  await page.getByLabel('Period end').fill(fmt(sun));
  await page.getByLabel('Total hours').fill('40');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: /Gallery/ }).click()]);
  await chooser.setFiles(__dirname + '/fixtures/photo.jpg');
  await page.getByText(/Attach payslip \(/).waitFor();
  await page.getByRole('button', { name: /Save payslip/ }).click();
  await page.getByText("of 179 days (estimate)").waitFor({ timeout: 15000 });
  await sleep(1000);
  const t2 = await total(page);
  const file = sql(`select count(*) from payslips p join storage.objects o on o.name = p.file_path and o.bucket_id='payslips' where p.worker_id='${SAM}'`);
  if (file !== '1') throw new Error('payslip file not stored');
  if (t2 !== t1 + 7) throw new Error(`expected ${t1 + 7} after full-time payslip week, got ${t2}`);
  await page.screenshot({ path: `${OUT}/m6-2-after.png` });
  console.log('PASS full-time payslip week adds 7 days; file stored privately ->', t2);

  // Employer detail
  await page.getByText('Lockyer Fresh Farms', { exact: true }).last().click({ force: true });
  await page.getByText('Payslips (1)').waitFor({ timeout: 15000 });
  await page.getByText(/file attached/).waitFor();
  await page.screenshot({ path: `${OUT}/m6-3-employer.png` });
  console.log('PASS employer detail lists payslip and shifts');

  console.log('page errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(async (e) => {
  if (page) await page.screenshot({ path: `${OUT}/m6-fail.png` }).catch(() => {});
  console.error('FAIL', e.message.split('\n').slice(0, 5).join('\n'));
  process.exit(1);
});
