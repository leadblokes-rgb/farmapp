import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs build script
import { matchingBundleOptions } from '../../../scripts/build-functions.mjs';

const root = resolve(__dirname, '../../..');

describe('Edge Function bundle', () => {
  it('is up to date with packages/matching (run `npm run build:functions` if this fails)', async () => {
    const result = await build({
      ...matchingBundleOptions,
      absWorkingDir: root,
      write: false,
    });
    const fresh = result.outputFiles[0]!.text;
    const committed = readFileSync(resolve(root, 'supabase/functions/_shared/matching.js'), 'utf8');
    expect(committed).toBe(fresh);
  });
});
