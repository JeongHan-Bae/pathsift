import { fileURLToPath } from 'node:url';
import { runCommand } from './run-command.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run through npm run check:dependencies');

for (const args of [
  ['audit', '--omit=dev', '--audit-level=moderate'],
  ['audit', '--audit-level=moderate']
]) {
  const result = await runCommand(process.execPath, [npmCli, ...args], { cwd: root, timeoutMs: 120000 });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`npm ${args.join(' ')} failed with status ${result.status}`);
}
