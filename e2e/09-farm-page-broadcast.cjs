// Farm page (logo, photos, website), reposting a job, and crew broadcast messages.
const { chromium, launchOptions } = require('./lib.cjs');
const { execSync } = require('child_process');
const OUT = require('./lib.cjs').OUT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sql = (q) => execSync(`psql -tA postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "${q}"`).toString().trim();
const LOCKYER = 'f0000000-0000-0000-0000-000000000001';
const PHOTO = __dirname + '/fixtures/photo.jpg';

const ddmmyyyy = (offsetDays) => {
  const d = new Date();
  d.setHours(12);
  d.setDate(d.getDate() + offsetDays);
  return `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`;
};

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
  const upload = async (p, button) => {
    const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.getByRole('button', { name: button }).first().click()]);
    await chooser.setFiles(PHOTO);
  };

  // ---------- Farm page editor ----------
  farm = await open("I'm a farm or employer", 'Demo farm (verified)');
  await farm.getByRole('tab', { name: /Farm/ }).click({ timeout: 30000 });
  await farm.getByText('Your farm page').scrollIntoViewIfNeeded();
  await upload(farm, 'Add a logo');
  await farm.getByText('Logo updated').waitFor({ timeout: 20000 });
  await upload(farm, 'Add photo');
  await farm.getByText('Photo added').waitFor({ timeout: 20000 });
  await farm.getByLabel('Website').fill('https://lockyer.example/jobs');
  await farm.getByRole('button', { name: 'Save farm page' }).click();
  await farm.getByText('Farm page saved').waitFor();
  const page = sql(`select (logo_path is not null) || '|' || cardinality(photos) || '|' || website || '|' || verification_status from farms where id='${LOCKYER}'`);
  if (page !== 'true|1|https://lockyer.example/jobs|verified') throw new Error('farm page not saved: ' + page);
  await farm.screenshot({ path: `${OUT}/b-1-farm-page-editor.png`, fullPage: true });
  console.log('PASS farm adds logo, photo and website (stays verified)');

  // ---------- Repost a job ----------
  await farm.getByRole('tab', { name: /Jobs/ }).click();
  await farm.getByText('Lettuce harvest crew').click();
  await farm.getByRole('button', { name: /Repost/ }).click({ timeout: 30000 });
  await farm.getByText('Copied from your earlier job').waitFor({ timeout: 15000 });
  const title = await farm.getByLabel('Job title').inputValue();
  if (title !== 'Lettuce harvest crew') throw new Error('repost not prefilled: ' + title);
  if ((await farm.getByLabel('Start date', { exact: true }).inputValue()) !== '') throw new Error('dates not cleared');
  await farm.getByLabel('Start date', { exact: true }).fill(ddmmyyyy(120));
  await farm.getByLabel('End date', { exact: true }).fill(ddmmyyyy(200));
  await farm.getByRole('button', { name: 'Post job' }).click();
  await farm.getByText('No one waiting for review.').waitFor({ timeout: 20000 });
  const copies = sql(`select count(*) from jobs where title='Lettuce harvest crew' and farm_id='${LOCKYER}'`);
  if (copies !== '2') throw new Error('repost not saved: ' + copies);
  console.log('PASS repost copies the job with new dates');
  await farm.goto('http://localhost:8081/farm');

  // ---------- Crew broadcast ----------
  await farm.getByText('Tractor driver (onion season)').click();
  await farm.getByRole('button', { name: /Message crew/ }).click({ timeout: 30000 });
  await farm.getByLabel('Crew message').fill('Start 6am Monday at the main shed.');
  await farm.getByRole('button', { name: 'Send to 1' }).click();
  await farm.getByText('Sent to 1 worker').waitFor();
  const sent = sql(`select count(*) from messages where broadcast_id is not null and body='Start 6am Monday at the main shed.'`);
  if (sent !== '1') throw new Error('broadcast not stored: ' + sent);
  console.log('PASS farm messages the accepted crew');

  // ---------- Worker sees it, and the farm page ----------
  worker = await open("I'm looking for work", 'Demo worker');
  await worker.getByTestId('swipe-card').waitFor({ timeout: 30000 });
  await worker.getByRole('tab', { name: /Matches/ }).click();
  await worker.getByLabel(/Chat with Lockyer Fresh Farms/).click();
  await worker.getByText('Start 6am Monday at the main shed.').last().waitFor({ timeout: 15000 });
  await worker.getByText('📣 Message to the whole crew').waitFor();
  console.log('PASS worker gets the crew message in their own chat');
  await worker.goBack();

  await worker.getByRole('tab', { name: /Discover/ }).click();
  await worker.getByTestId('swipe-card').click();
  await worker.getByRole('button', { name: /About Lockyer Fresh Farms/ }).click();
  await worker.getByText('lockyer.example/jobs').waitFor({ timeout: 15000 });
  await worker.getByText(/Gatton has hostels/).waitFor();
  await worker.getByText('What workers say').waitFor();
  await worker.screenshot({ path: `${OUT}/b-2-farm-page.png`, fullPage: true });
  await worker.getByText('Open jobs', { exact: false }).scrollIntoViewIfNeeded();
  const applyButtons = worker.getByRole('button', { name: 'Apply' });
  const before = await applyButtons.count();
  await applyButtons.first().click();
  await worker.getByText(/^Applied for /).waitFor();
  await sleep(500);
  const applied = sql(`select count(*) from applications a join jobs j on j.id=a.job_id where a.worker_id='11111111-1111-1111-1111-111111111111' and j.farm_id='${LOCKYER}' and a.status='applied'`);
  if (applied !== '1') throw new Error('apply from farm page failed: ' + applied);
  if ((await applyButtons.count()) !== before - 1) throw new Error('job not marked as applied');
  console.log('PASS worker reads the farm page and applies from it');

  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
  console.log('page errors: none');
  await browser.close();
})().catch(async (e) => {
  console.log('FAIL', e.message);
  for (const [name, p] of [['worker', worker], ['farm', farm]]) {
    if (p) await p.screenshot({ path: `${OUT}/b-fail-${name}.png` }).catch(() => {});
  }
  process.exit(1);
});
