import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runCommand } from './run-command.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const mode = process.argv[2] || 'compiled';
if (!['source', 'compiled', 'package'].includes(mode)) throw new Error(`Unknown BDD mode: ${mode}`);
const folder = path.join(root, 'test', 'bdd');
const files = (await readdir(folder)).filter(name => name.endsWith('.test.mjs')).sort().map(name => path.join(folder, name));
const result = await runCommand(process.execPath, ['--test', ...files], {
  cwd: root,
  env: { ...process.env, PATHSIFT_TEST_MODE: mode },
  timeoutMs: mode === 'source' ? 300000 : 180000
});
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.status ?? 1;
