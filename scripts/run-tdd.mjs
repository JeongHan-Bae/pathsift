import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const folder = path.join(root, 'test', 'tdd');
const tests = (await readdir(folder)).filter(name => name.endsWith('.test.mjs')).sort().map(name => path.join(folder, name));
const result = spawnSync(process.execPath, ['--test', path.join(root, 'test', 'basic.test.mjs'), ...tests], {
  cwd: root, stdio: 'inherit'
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
