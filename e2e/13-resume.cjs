// Resume import on the worker profile, and farms opening an applicant's resume.
const { chromium, launchOptions } = require('./lib.cjs');
const { execSync } = require('child_process');
const OUT = require('./lib.cjs').OUT;
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

  worker = await open("I'm looking for work", 'Demo worker');
  await worker.getByRole('tab', { name: /Profile/ }).click({ timeout: 30000 });
  await worker.getByText('Resume', { exact: true }).scrollIntoViewIfNeeded({ timeout: 30000 });
  const [chooser] = await Promise.all([
    worker.waitForEvent('filechooser'),
    worker.getByRole('button', { name: /Import resume/ }).click(),
  ]);
  await chooser.setFiles(__dirname + '/fixtures/resume.pdf');
  await worker.getByText('Resume added').waitFor({ timeout: 20000 });
  await worker.getByText('resume.pdf').waitFor();
  const stored = sql(`select wp.resume_name || '|' || (select count(*) from storage.objects o where o.bucket_id = 'resumes' and o.name = wp.resume_path) from worker_profiles wp where user_id = '${SAM}'`);
  if (stored !== 'resume.pdf|1') throw new Error('resume not stored: ' + stored);
  await worker.screenshot({ path: `${OUT}/g-1-resume.png` });
  console.log('PASS worker imports a resume (stored privately)');

  farm = await open("I'm a farm or employer", 'Demo farm (verified)');
  await farm.getByText('Tractor driver (onion season)').click({ timeout: 30000 });
  await farm.getByRole('radio', { name: /Accepted/ }).click({ timeout: 30000 });
  await farm.getByText('Sam Taylor', { exact: true }).last().click({ force: true });
  const view = farm.getByRole('button', { name: 'View resume' });
  await view.waitFor({ timeout: 20000 });
  const [popup] = await Promise.all([farm.context().waitForEvent('page'), view.click()]);
  await popup.waitForLoadState().catch(() => {});
  if (!/\/storage\/v1\/object\/sign\/resumes\//.test(popup.url())) throw new Error('resume did not open: ' + popup.url());
  console.log('PASS the farm opens the applicant’s resume');

  await worker.getByRole('button', { name: /^Remove$/ }).click();
  await worker.getByText('Resume removed').waitFor();
  const left = sql(`select count(*) from storage.objects where bucket_id = 'resumes'`);
  if (left !== '0' || sql(`select coalesce(resume_path, 'none') from worker_profiles where user_id = '${SAM}'`) !== 'none')
    throw new Error('resume not removed');
  console.log('PASS worker removes their resume');

  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
  console.log('page errors: none');
  await browser.close();
})().catch(async (e) => {
  console.log('FAIL', e.message);
  for (const [n, p] of [['worker', worker], ['farm', farm]]) if (p) await p.screenshot({ path: `${OUT}/g-fail-${n}.png` }).catch(() => {});
  process.exit(1);
});
