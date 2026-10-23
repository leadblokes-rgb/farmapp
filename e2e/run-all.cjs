// Runs every browser test against a freshly reset local database.
// Prerequisites: `npm run db:start`, and the web app running (`cd apps/mobile && npx expo start --web --port 8081`).
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const tests = fs.readdirSync(__dirname).filter((f) => /^\d.*\.cjs$/.test(f)).sort();
let failed = 0;
for (const t of tests) {
  console.log(`\n=== ${t}`);
  execSync('npx supabase db reset', { stdio: 'ignore', cwd: path.join(__dirname, '..') });
  // Each suite's full output is also kept in screenshots/<suite>.log for diagnosing failures.
  const log = path.join(__dirname, 'screenshots', t.replace(/\.cjs$/, '.log'));
  try {
    const out = execSync(`node ${path.join(__dirname, t)}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    process.stdout.write(out);
    fs.writeFileSync(log, out);
  } catch (e) {
    const out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    process.stdout.write(out);
    fs.writeFileSync(log, out);
    failed++;
  }
}
console.log(failed ? `\n${failed} suite(s) failed` : '\nAll browser suites passed');
process.exit(failed ? 1 : 0);
