// Chat contact filter: contact details are hidden (#####) until the farm accepts the worker.
const { chromium, launchOptions } = require('./lib.cjs');
const { execSync } = require('child_process');
const OUT = require('./lib.cjs').OUT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sql = (q) => execSync(`psql -tA postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "${q}"`).toString().trim();

let farm;
(async () => {
  const browser = await chromium.launch(launchOptions);
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  farm = await ctx.newPage();
  farm.on('pageerror', (e) => errors.push(e.message));
  await farm.goto('http://localhost:8081', { timeout: 120000 });
  await farm.getByText("I'm a farm or employer").click({ timeout: 120000 });
  await farm.getByText('Demo farm (verified)', { exact: true }).click();

  // ---------- Before acceptance: masked ----------
  await farm.getByText('Lettuce harvest crew').click({ timeout: 30000 });
  await farm.getByText('To review (15)').waitFor({ timeout: 30000 });
  const name = (await farm.locator('[aria-label^="Select "]').first().getAttribute('aria-label')).replace('Select ', '');
  const first = name.split(' ')[0];
  await farm.getByText(name, { exact: true }).last().click({ force: true });
  await farm.getByRole('button', { name: new RegExp(`Message ${first}`) }).click();
  await farm.getByText(`hidden (#####) until you accept ${first}`, { exact: false }).waitFor({ timeout: 15000 });
  await farm.getByLabel('Message', { exact: true }).fill('Call me on 0412 345 678 or email boss@lockyer.example');
  await farm.getByLabel('Send message').click();
  await farm.getByText('Call me on ##### or email #####', { exact: true }).waitFor({ timeout: 15000 });
  await farm.getByText('Contact details hidden until hired').waitFor();
  await farm.screenshot({ path: `${OUT}/f-1-masked.png` });
  const stored = sql(`select body from messages where body like 'Call me on %'`);
  if (stored.includes('0412')) throw new Error('number stored unmasked: ' + stored);
  const logged = sql(`select count(*) from contact_share_attempts where original_body like '%0412 345 678%'`);
  if (logged !== '1') throw new Error('attempt not logged for admins');
  console.log('PASS before acceptance, phone and email are hidden and the attempt is logged');

  // ---------- After acceptance: shown ----------
  sql(`update applications set status = 'accepted', decided_at = now()
       where id = (select application_id from conversations c join messages m on m.conversation_id = c.id where m.body like 'Call me on %')`);
  await farm.reload();
  await farm.getByLabel('Message', { exact: true }).waitFor({ timeout: 60000 });
  await sleep(1000);
  if (await farm.getByText(/until you accept/).count()) throw new Error('filter notice still shown after acceptance');
  await farm.getByLabel('Message', { exact: true }).fill('Hired! My number is 0412 345 678');
  await farm.getByLabel('Send message').click();
  await farm.getByText('Hired! My number is 0412 345 678', { exact: true }).waitFor({ timeout: 15000 });
  console.log('PASS after acceptance, contact details go through');

  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
  console.log('page errors: none');
  await browser.close();
})().catch(async (e) => {
  console.log('FAIL', e.message);
  if (farm) await farm.screenshot({ path: `${OUT}/f-fail.png` }).catch(() => {});
  process.exit(1);
});
