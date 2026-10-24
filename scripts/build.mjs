import { rm, chmod } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runCommand } from './run-command.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
await rm(dist, { recursive: true, force: true });
const compiler = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const result = await runCommand(process.execPath, [compiler, '--project', path.join(root, 'tsconfig.json')], { cwd: root, timeoutMs: 120000 });
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
if (result.status !== 0) process.exit(result.status ?? 1);
await chmod(path.join(dist, 'boot', 'cli-main.js'), 0o755);
