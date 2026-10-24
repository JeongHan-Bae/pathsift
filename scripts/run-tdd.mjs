import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runCommand } from './run-command.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const folder = path.join(root, 'test', 'tdd');
const tests = (await readdir(folder)).filter(name => name.endsWith('.test.mjs')).sort().map(name => path.join(folder, name));
const result = await runCommand(process.execPath, ['--test', path.join(root, 'test', 'basic.test.mjs'), ...tests], { cwd: root, timeoutMs: 180000 });
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.status ?? 1;
