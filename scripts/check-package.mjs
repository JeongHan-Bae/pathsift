import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { preparePackage } from './package-artifact.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run through npm run check:package');
async function distFiles(directory, prefix = 'dist') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await distFiles(path.join(directory, entry.name), relative));
    else files.push(relative);
  }
  return files;
}
const sandbox = await mkdtemp(path.join(tmpdir(), 'pathsift-package-check-'));
try {
  const directory = await preparePackage(sandbox);
  const result = spawnSync(process.execPath, [npmCli, 'pack', '--dry-run', '--json'], { cwd: directory, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`npm pack failed:\n${result.stderr}`);
  const [preview] = JSON.parse(result.stdout);
  const actual = preview.files.map(file => file.path).sort();
  const expected = [
    'LICENSE', 'README.md', 'docs/architecture.md', 'docs/hash.md', 'global.ignore', 'package.json', 'pathsift.config.json',
    ...await distFiles(path.join(root, 'dist'))
  ].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Package file list differs.\nExpected: ${expected.join(', ')}\nActual: ${actual.join(', ')}`);
  }
  const packageReadme = await readFile(path.join(directory, 'README.md'), 'utf8');
  if (packageReadme !== await readFile(path.join(root, 'docs/npm-readme.md'), 'utf8') ||
      packageReadme === await readFile(path.join(root, 'README.md'), 'utf8')) {
    throw new Error('Published README must be the npm usage README, not the repository README');
  }
  const manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  if (manifest.private !== undefined || manifest.scripts !== undefined || manifest.devDependencies !== undefined) {
    throw new Error('Published manifest must exclude repository-only metadata');
  }
  if (!actual.includes('dist/boot/cli-main.js') || actual.some(file => file.endsWith('.ts') || file.startsWith('src/'))) {
    throw new Error('Package must contain compiled CLI JavaScript and no TypeScript source');
  }
  console.log(`Package contents checked (${actual.length} files).`);
} finally {
  await rm(sandbox, { recursive: true, force: true });
}
