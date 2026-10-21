const { chromium, launchOptions } = require('./lib.cjs');
const { execSync } = require('child_process');
const OUT = require('./lib.cjs').OUT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sql = (q) => execSync(`psql -tA postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "${q}"`).toString().trim();
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

  // ---------- Worker: unread badge + chat list ----------
  worker = await open("I'm looking for work", 'Demo worker');
  await worker.getByTestId('swipe-card').waitFor({ timeout: 30000 });
  await worker.getByRole('tab', { name: /Matches/ }).click();
  await worker.getByText('Messages (2 new)').waitFor({ timeout: 15000 });
  await worker.getByLabel(/Chat with Lockyer Fresh Farms, 2 unread/).waitFor();
  await worker.screenshot({ path: `${OUT}/m5-1-worker-messages.png` });
  console.log('PASS worker sees 2 unread from the farm');

  await worker.getByLabel(/Chat with Lockyer Fresh Farms/).click();
  await worker.getByText('Yes please. Hi-vis is supplied.', { exact: true }).waitFor({ timeout: 15000 });
  await sleep(1500);
  const unread = sql(`select count(*) from messages m join conversations c on c.id=m.conversation_id where c.worker_id='${SAM}' and m.sender_id<>'${SAM}' and m.read_at is null`);
  if (unread !== '0') throw new Error('messages not marked read: ' + unread);
  console.log('PASS opening chat marks messages read');

  // ---------- Farm opens the same chat; realtime both ways ----------
  farm = await open("I'm a farm or employer", 'Demo farm (verified)');
  await farm.getByRole('tab', { name: /Messages/ }).click({ timeout: 30000 });
  await farm.getByLabel(/Chat with Sam Taylor/).click();
  await farm.getByText('Yes, I can! Do I need steel-capped boots?', { exact: true }).waitFor({ timeout: 15000 });

  await worker.getByLabel('Message', { exact: true }).fill('Running 10 minutes late on day one, sorry!');
  await worker.getByLabel('Send message').click();
  await farm.getByText('Running 10 minutes late on day one, sorry!', { exact: true }).waitFor({ timeout: 15000 });
  console.log('PASS worker -> farm message arrives live (Realtime)');

  await farm.getByLabel('Message', { exact: true }).fill('No worries, see you then.');
  await farm.getByLabel('Send message').click();
  await worker.getByText('No worries, see you then.', { exact: true }).waitFor({ timeout: 15000 });
  await worker.screenshot({ path: `${OUT}/m5-2-chat.png` });
  console.log('PASS farm -> worker message arrives live (Realtime)');

  // ---------- Farm messages an applicant before accepting ----------
  await farm.goBack();
  await farm.getByRole('tab', { name: /Jobs/ }).click();
  await farm.getByText('Lettuce harvest crew').click();
  await farm.getByText('To review (15)').waitFor({ timeout: 30000 });
  const first = (await farm.locator('[aria-label^="Select "]').first().getAttribute('aria-label')).replace('Select ', '');
  await farm.getByText(first, { exact: true }).last().click({ force: true });
  await farm.getByRole('button', { name: new RegExp(`Message ${first.split(' ')[0]}`) }).click();
  await farm.getByText('Say hello 👋').waitFor({ timeout: 15000 });
  await farm.getByLabel('Message', { exact: true }).fill('Hi! Are you still available from next week?');
  await farm.getByLabel('Send message').click();
  await farm.getByText('Hi! Are you still available from next week?', { exact: true }).waitFor();
  const preAccept = sql(`select a.status from conversations c join applications a on a.id=c.application_id join worker_profiles wp on wp.user_id=c.worker_id where wp.full_name='${first.replace(/'/g, "''")}' and a.job_id='a0000000-0000-0000-0000-000000000001'`);
  if (preAccept !== 'applied') throw new Error('expected pre-accept conversation, got ' + preAccept);
  console.log('PASS farm messaged', first, 'before accepting');

  // ---------- Reports ----------
  await worker.getByLabel('Report').click();
  await worker.getByRole('radio', { name: 'Underpaid / not paid' }).click();
  await worker.getByLabel('What happened?').fill('Test report from e2e');
  await worker.getByRole('button', { name: 'Send report' }).click();
  await worker.getByText('Thanks. The Croppr team will review your report.').waitFor();
  const rep = sql(`select r.reason||'|'||(r.target_user_id='22222222-2222-2222-2222-222222222222') from reports r where details='Test report from e2e'`);
  if (rep !== 'underpaid|true') throw new Error('report wrong: ' + rep);
  console.log('PASS report from chat targets the farm owner');

  await worker.goBack();
  await worker.getByRole('tab', { name: /Discover/ }).click();
  await worker.getByText('Tap for details').click({ force: true, timeout: 20000 });
  await worker.getByRole('button', { name: /Report this job/ }).click();
  await worker.getByRole('radio', { name: 'Scam or asks for money' }).click();
  await worker.getByRole('button', { name: 'Send report' }).click();
  await worker.getByText('Thanks. The Croppr team will review your report.').waitFor();
  const jobRep = sql(`select count(*) from reports where reason='scam' and target_job_id is not null and target_user_id is not null`);
  if (jobRep !== '1') throw new Error('job report missing');
  console.log('PASS report a job from the feed');

  // ---------- Notifications were triggered ----------
  await sleep(4000);
  const log = sql(`select string_agg(event||':'||outcome, ', ' order by id) from notification_log`);
  console.log('INFO notification_log:', log);
  if (!/message:no_tokens/.test(log)) throw new Error('message notifications not triggered');
  console.log('PASS message events reached send-push');

  console.log('page errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(async (e) => {
  for (const [n, p] of [['worker', worker], ['farm', farm]]) if (p) await p.screenshot({ path: `${OUT}/m5-fail-${n}.png` }).catch(() => {});
  console.error('FAIL', e.message.split('\n').slice(0, 5).join('\n'));
  process.exit(1);
});
