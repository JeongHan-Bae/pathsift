import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const launcher = fileURLToPath(new URL('../../bin/pathsift.cjs', import.meta.url));

test('source checkout launcher selects the branch for this Node version', async () => {
  const result = await exec(process.execPath, [launcher, '--help'], {
    env: { ...process.env, PATHSIFT_LAUNCH_TRACE: '1' }
  });
  const expected = Number(process.versions.node.split('.')[0]) >= 24 ? 'source-ts' : 'compiled-js';
  assert.equal(result.stderr, `pathsift launch: ${expected}\n`);
  assert.match(result.stdout, /pathsift archive/);
});
