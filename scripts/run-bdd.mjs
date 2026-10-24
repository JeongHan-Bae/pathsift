import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const mode = process.argv[2] || 'compiled';
if (!['source', 'compiled', 'package'].includes(mode)) throw new Error(`Unknown BDD mode: ${mode}`);
const folder = path.join(root, 'test', 'bdd');
const files = (await readdir(folder)).filter(name => name.endsWith('.test.mjs')).sort().map(name => path.join(folder, name));
const result = spawnSync(process.execPath, ['--test', ...files], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, PATHSIFT_TEST_MODE: mode }
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
