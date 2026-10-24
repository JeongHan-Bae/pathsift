import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { preparePackage } from './package-artifact.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run package tests through npm run test:package');
const sandbox = await mkdtemp(path.join(tmpdir(), 'pathsift-package-'));
try {
  const runNpm = (args, options = {}) => {
    const result = spawnSync(process.execPath, [npmCli, ...args], { cwd: root, encoding: 'utf8', ...options });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`npm ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
    return result.stdout;
  };
  const packageInput = await preparePackage(sandbox);
  const [packed] = JSON.parse(runNpm(['pack', '--json', '--pack-destination', sandbox], { cwd: packageInput }));
  const tarball = path.join(sandbox, packed.filename);
  const consumer = path.join(sandbox, 'consumer');
  runNpm(['install', '--prefix', consumer, '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund', tarball]);
  const packageRoot = path.join(consumer, 'node_modules', 'pathsift');
  const manifest = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
  if (manifest.bin.pathsift !== './dist/boot/cli-main.js') throw new Error('Published bin does not point to compiled JavaScript');
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'run-bdd.mjs'), 'package'], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      PATHSIFT_TEST_PACKAGE_ROOT: packageRoot,
      PATHSIFT_TEST_MODULES_ROOT: path.join(consumer, 'node_modules')
    }
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  await rm(sandbox, { recursive: true, force: true });
}
