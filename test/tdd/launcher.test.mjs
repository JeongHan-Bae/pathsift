import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const launcher = fileURLToPath(new URL('../../bin/pathsift.cjs', import.meta.url));

test('source checkout launcher selects the branch for this Node version', async () => {
  const result = spawnSync(process.execPath, [launcher, '--help'], {
    env: { ...process.env, PATHSIFT_LAUNCH_TRACE: '1' }, encoding: 'utf8'
  });
  assert.equal(result.status, 0);
  const expected = Number(process.versions.node.split('.')[0]) >= 24 ? 'source-ts' : 'compiled-js';
  assert.equal(result.stderr, `pathsift launch: ${expected}\n`);
  assert.match(result.stdout, /pathsift archive/);
});
