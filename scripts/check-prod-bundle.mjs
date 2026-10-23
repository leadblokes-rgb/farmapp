// Builds production iOS and Android bundles and fails if any demo account details are inside.
// Run with `npm run check:prod-bundle` before releasing.
import { execSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = mkdtempSync(join(tmpdir(), 'croppr-prod-'));
const FORBIDDEN = ['croppr-demo', 'demo.croppr.test', 'Demo worker'];
const files = (dir) =>
  readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));

try {
  execSync(`npx expo export --platform ios --platform android --output-dir ${out}`, {
    cwd: new URL('../apps/mobile', import.meta.url).pathname,
    stdio: 'inherit',
    // Even with demo buttons switched on locally, production builds must not contain them.
    env: { ...process.env, EXPO_PUBLIC_SHOW_DEMO_ACCOUNTS: 'true' },
  });
  const bundles = files(out).filter((f) => /\.(hbc|js)$/.test(f));
  const found = bundles.flatMap((f) => {
    const text = readFileSync(f, 'latin1');
    return FORBIDDEN.filter((w) => text.includes(w)).map((w) => `${w} in ${f}`);
  });
  if (!bundles.length) throw new Error('No bundles were produced');
  if (found.length) {
    console.error('Demo account details found in production bundles:\n' + found.join('\n'));
    process.exit(1);
  }
  console.log(`OK: no demo account details in ${bundles.length} production bundles`);
} finally {
  rmSync(out, { recursive: true, force: true });
}
