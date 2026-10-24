// Saved jobs, job alerts, and specified-work postcode checks (plant & animal cultivation).
const { chromium, launchOptions } = require('./lib.cjs');
const { execSync } = require('child_process');
const OUT = require('./lib.cjs').OUT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sql = (q) =>
  execSync(`psql -tA postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "${q}"`).toString().trim();
const SAM = '11111111-1111-1111-1111-111111111111';

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

  // ---------- Postcode eligibility on the job card (Sam is on a 417) ----------
  worker = await open("I'm looking for work", 'Demo worker');
  await worker.getByTestId('swipe-card').waitFor({ timeout: 30000 });
  await worker
    .getByTestId('swipe-card')
    .getByText('Eligible postcode for 417 plant & animal cultivation')
    .waitFor();
  console.log('PASS job card shows postcode eligibility for the worker’s visa');

  // ---------- Save for later ----------
  const title = await worker.getByTestId('swipe-card').getByTestId('job-title').innerText();
  const before = await worker.getByText(/\d+ jobs? for you/).innerText();
  await worker.getByRole('button', { name: 'Save for later' }).click();
  await worker.getByText(/Saved for later/).waitFor();
  const saved = sql(`select count(*) from saved_jobs where worker_id='${SAM}'`);
  if (saved !== '1') throw new Error('job not saved: ' + saved);
  const after = await worker.getByText(/\d+ jobs? for you/).innerText();
  if (parseInt(after) !== parseInt(before) - 1) throw new Error(`feed count ${before} -> ${after}`);
  console.log('PASS saving a job takes it out of the feed');

  await worker.getByRole('tab', { name: /Matches/ }).click();
  await worker.getByRole('radio', { name: 'Saved (1)' }).click({ timeout: 15000 });
  await worker.getByText(title, { exact: true }).waitFor();
  await worker.screenshot({ path: `${OUT}/c-1-saved.png` });
  await worker.getByRole('button', { name: `Apply for ${title}` }).click();
  await worker.getByText(`Applied to ${title}`).waitFor();
  await worker.getByRole('radio', { name: 'Saved (0)' }).waitFor({ timeout: 15000 });
  const applied = sql(
    `select count(*) from applications a join jobs j on j.id=a.job_id where a.worker_id='${SAM}' and j.title='${title.replace(/'/g, "''")}'`,
  );
  if (applied !== '1') throw new Error('apply from saved failed');
  console.log('PASS apply from the saved list');

  // ---------- Job alerts ----------
  await worker.getByRole('tab', { name: /Profile/ }).click();
  await worker.getByText('Job alerts', { exact: true }).scrollIntoViewIfNeeded({ timeout: 30000 });
  await worker.getByRole('switch', { name: 'Only jobs with accommodation' }).click();
  await worker.getByRole('button', { name: 'Save job alerts' }).click();
  await worker.getByText('Job alerts on').waitFor();
  if (sql(`select accommodation_only from job_alerts where worker_id='${SAM}'`) !== 't')
    throw new Error('alert not saved');
  // Turn accommodation back off and instant alerts off, so the next job waits for the digest.
  await worker.getByRole('switch', { name: 'Only jobs with accommodation' }).click();
  await worker.getByRole('switch', { name: 'Tell me straight away about great matches' }).click();
  await worker.getByRole('button', { name: 'Save job alerts' }).click();
  await sleep(1000);
  if (
    sql(
      `select accommodation_only::text || instant_top_matches::text from job_alerts where worker_id='${SAM}'`,
    ) !== 'falsefalse'
  )
    throw new Error('alert not updated');
  console.log('PASS worker edits job alerts');

  sql(`insert into jobs (farm_id, title, role_type, postcode, start_date, end_date, workers_needed, pay_type, pay_rate_cents, hours_per_week)
       values ('f0000000-0000-0000-0000-000000000001', 'Alert test: cabbage cutting', 'picking', '4343', current_date + 5, current_date + 40, 6, 'hourly', 3300, 38)`);
  let queued = '0';
  for (let i = 0; i < 20 && queued === '0'; i++) {
    await sleep(500);
    queued = sql(
      `select count(*) from job_alert_queue q join jobs j on j.id=q.job_id where q.worker_id='${SAM}' and j.title like 'Alert test%'`,
    );
  }
  if (queued !== '1') throw new Error("matching job not queued for Sam's digest");
  if (
    sql(`select count(*) from notification_log where event='job_alert_instant' and recipient_id='${SAM}'`) !==
    '0'
  )
    throw new Error('instant alert sent although turned off');
  sql('select public.send_job_alert_digest()');
  let digest = '0';
  for (let i = 0; i < 20 && digest === '0'; i++) {
    await sleep(500);
    digest = sql(
      `select count(*) from notification_log where event='job_alert_digest' and recipient_id='${SAM}' and title like '%new job%'`,
    );
  }
  if (digest !== '1') throw new Error('daily digest not sent to Sam');
  console.log('PASS a new matching job goes into the daily digest');

  // ---------- Notification settings ----------
  await worker.getByText('Notifications', { exact: true }).scrollIntoViewIfNeeded();
  await worker.getByRole('switch', { name: 'Messages' }).click();
  await worker.getByText('Notification settings saved').waitFor();
  if (sql(`select messages from notification_prefs where user_id='${SAM}'`) !== 'f')
    throw new Error('prefs not saved');
  await worker.getByRole('switch', { name: 'Messages' }).click();
  await sleep(1000);
  if (sql(`select messages from notification_prefs where user_id='${SAM}'`) !== 't')
    throw new Error('prefs not updated');
  console.log('PASS worker changes notification settings');

  // ---------- Tracker employer postcode check ----------
  await worker.goto('http://localhost:8081/worker/employer/new');
  await worker.getByLabel('Work postcode').fill('4000', { timeout: 60000 });
  await worker.getByText(/Not an eligible postcode for 417/).waitFor();
  await worker.getByLabel('Work postcode').fill('4343');
  await worker.getByText(/Eligible postcode for 417 plant & animal cultivation/).waitFor();
  console.log('PASS tracker employer form checks the postcode');

  // ---------- Farm job form auto-ticks specified work ----------
  farm = await open("I'm a farm or employer", 'Demo farm (verified)');
  await farm.getByRole('button', { name: /Post a job/ }).click({ timeout: 30000 });
  const sw = farm.getByRole('switch', { name: 'Likely counts as specified work' });
  const checked = async (want) => {
    for (let i = 0; i < 20; i++) {
      if ((await sw.getAttribute('aria-checked')) === want) return true;
      await sleep(250);
    }
    return false;
  };
  await farm.getByLabel('Work location postcode').fill('4000');
  if (!(await checked('false'))) throw new Error('not unticked for Brisbane CBD');
  await sw.click();
  await farm.getByText(/isn’t on the eligible list/).waitFor();
  await farm.getByLabel('Work location postcode').fill('4343');
  if (!(await checked('true'))) throw new Error('not ticked for Gatton');
  if (await farm.getByText(/isn’t on the eligible list/).count()) throw new Error('warning still shown');
  await farm.screenshot({ path: `${OUT}/c-2-job-form.png` });
  console.log('PASS job form ticks specified work from the postcode');

  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
  console.log('page errors: none');
  await browser.close();
})().catch(async (e) => {
  console.log('FAIL', e.message);
  for (const [name, p] of [
    ['worker', worker],
    ['farm', farm],
  ]) {
    if (p) await p.screenshot({ path: `${OUT}/c-fail-${name}.png` }).catch(() => {});
  }
  process.exit(1);
});
