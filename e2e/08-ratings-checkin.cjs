// Trust loop: blind two-way ratings, review reports, crew check-in and no-show disputes.
const { chromium, launchOptions } = require('./lib.cjs');
const { execSync } = require('child_process');
const OUT = require('./lib.cjs').OUT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sql = (q) => execSync(`psql -tA postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "${q}"`).toString().trim();
const SAM_PAST = 'ab000000-0000-0000-0000-000000000002'; // Sam on the finished Lockyer job
const SAM_TRACTOR = 'ab000000-0000-0000-0000-000000000001';

let worker, farm;
(async () => {
  const browser = await chromium.launch(launchOptions);
  const errors = [];
  const open = async (role, label) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto('http://localhost:8081', { timeout: 120000 });
    await p.getByText(role).click({ timeout: 120000 });
    await p.getByText(label, { exact: true }).click();
    return p;
  };

  // ---------- Worker rates the farm (blind) ----------
  worker = await open("I'm looking for work", 'Demo worker');
  await worker.getByTestId('swipe-card').waitFor({ timeout: 30000 });
  await worker.getByText(/\(2 reviews\)/).first().waitFor({ timeout: 15000 });
  console.log('PASS job card shows the farm rating');

  await worker.getByRole('tab', { name: /Matches/ }).click();
  await worker.getByRole('button', { name: 'Rate your time at Lockyer Fresh Farms' }).click({ timeout: 15000 });
  await worker.getByRole('radio', { name: 'Overall: 4 stars' }).click();
  await worker.getByText('Yes', { exact: true }).click();
  await worker.getByLabel('Comment').fill('Fair pay, early starts.');
  await worker.screenshot({ path: `${OUT}/a-1-rate-farm.png` });
  await worker.getByRole('button', { name: /Submit rating/ }).click();
  await worker.getByText('Thanks for rating Lockyer Fresh Farms').waitFor();
  const saved = sql(`select overall || '|' || would_work_again from farm_ratings where application_id='${SAM_PAST}'`);
  if (saved !== '4|true') throw new Error('farm rating not saved: ' + saved);
  if (sql(`select public.ratings_revealed('${SAM_PAST}')`) !== 'f') throw new Error('rating revealed too early');
  console.log('PASS worker rates the farm; hidden until the farm rates too');

  // ---------- Reviews on job details, and reporting one ----------
  await worker.getByRole('tab', { name: /Discover/ }).click();
  await worker.getByTestId('swipe-card').click();
  await worker.getByText('What workers say').waitFor({ timeout: 15000 });
  await worker.getByText(/Well organised, paid on time/).waitFor();
  if (await worker.getByText(/Fair pay, early starts/).count()) throw new Error('blind rating visible in reviews');
  await worker.getByRole('button', { name: 'Report review' }).first().click();
  await worker.getByLabel('What’s wrong?').fill('Seems fake');
  await worker.getByRole('button', { name: 'Send report' }).click();
  await worker.getByText('Reported. Thanks.').waitFor();
  const rep = sql(`select count(*) from reports where reason='inappropriate_review' and review_kind='farm'`);
  if (rep !== '1') throw new Error('review report not stored');
  console.log('PASS job details list farm reviews; a review can be reported');
  await worker.keyboard.press('Escape');

  // ---------- Farm rates the worker -> both revealed ----------
  farm = await open("I'm a farm or employer", 'Demo farm (verified)');
  await farm.getByText('Rate your crew (2)').waitFor({ timeout: 30000 });
  await farm.getByRole('button', { name: /Rate Sam Taylor/ }).click();
  await farm.getByRole('radio', { name: /Reliability \(on time, turned up\): 5 stars/ }).click();
  await farm.getByRole('radio', { name: 'Quality of work: 4 stars' }).click();
  await farm.getByRole('button', { name: /Submit rating/ }).click();
  await farm.getByText('Thanks for rating Sam Taylor').waitFor();
  await farm.getByText('Rate your crew (1)').waitFor();
  if (sql(`select public.ratings_revealed('${SAM_PAST}')`) !== 't') throw new Error('not revealed after both rated');
  console.log('PASS farm rates the worker; both ratings now revealed');

  // ---------- Reputation on the shortlist ----------
  await farm.getByText('Lettuce harvest crew').click();
  await farm.getByText(/5\.0 reliability \(1 rating\)/).waitFor({ timeout: 30000 });
  await farm.getByText('1 no-show').first().waitFor();
  await farm.screenshot({ path: `${OUT}/a-2-shortlist-reputation.png` });
  console.log('PASS shortlist shows reliability ratings and no-shows');
  await farm.goBack();

  // ---------- Day-one check-in ----------
  await farm.getByText('Celery harvest').click();
  await farm.getByRole('button', { name: /Who turned up\? Check in your crew/ }).click({ timeout: 30000 });
  await farm.getByText('Not checked in yet').first().waitFor({ timeout: 15000 });
  await farm.getByRole('button', { name: 'Emma Jansen: No-show' }).click();
  await farm.getByText('Emma: No-show').waitFor();
  await farm.getByRole('button', { name: /Everyone else turned up \(2\)/ }).click();
  await farm.getByText('Marked 2 as turned up').waitFor();
  await farm.screenshot({ path: `${OUT}/a-3-check-in.png` });
  const att = sql(`select string_agg(t.status::text, ',' order by t.status) from attendance t join applications a on a.id=t.application_id where a.job_id='a0000000-0000-0000-0000-000000000012'`);
  if (att !== 'showed,showed,no_show') throw new Error('attendance wrong: ' + att);
  await sleep(2500);
  const pushed = sql(`select count(*) from notification_log where event='no_show_marked'`);
  if (pushed !== '1') throw new Error('no-show push not sent: ' + pushed);
  console.log('PASS farm checks in the crew; the no-show is notified');

  // ---------- Worker disputes a no-show ----------
  sql(`insert into attendance (application_id, status) values ('${SAM_TRACTOR}', 'no_show')`);
  await worker.reload();
  await worker.getByRole('tab', { name: /Matches/ }).click({ timeout: 60000 });
  await worker.getByRole('radio', { name: /Applications/ }).click();
  await worker.getByText('Lockyer Fresh Farms marked you as a no-show.').first().waitFor({ timeout: 15000 });
  await worker.getByRole('button', { name: /Not right\? Dispute it/ }).click();
  await worker.getByLabel('What happened?').fill('I was there all day with Tom.');
  await worker.getByRole('button', { name: 'Send dispute' }).click();
  await worker.getByText('Dispute sent. The Croppr team will look into it.').waitFor();
  await worker.getByText(/You disputed this/).waitFor();
  const dispute = sql(`select r.reason || '|' || (t.disputed_at is not null) from attendance t join reports r on r.id=t.dispute_report_id where t.application_id='${SAM_TRACTOR}'`);
  if (dispute !== 'no_show_dispute|true') throw new Error('dispute not recorded: ' + dispute);
  await worker.screenshot({ path: `${OUT}/a-4-dispute.png` });
  console.log('PASS worker disputes a no-show; it goes to the reports queue');

  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
  console.log('page errors: none');
  await browser.close();
})().catch(async (e) => {
  console.log('FAIL', e.message);
  for (const [name, p] of [['worker', worker], ['farm', farm]]) {
    if (p) await p.screenshot({ path: `${OUT}/a-fail-${name}.png` }).catch(() => {});
  }
  process.exit(1);
});
