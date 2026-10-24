import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run through npm run check:package');
const result = spawnSync(process.execPath, [npmCli, 'pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: root, encoding: 'utf8' });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`npm pack failed:\n${result.stderr}`);
const [preview] = JSON.parse(result.stdout);
const actual = preview.files.map(file => file.path).sort();
async function distFiles(directory, prefix = 'dist') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await distFiles(path.join(directory, entry.name), relative));
    else files.push(relative);
  }
  return files;
}
const expected = [
  'LICENSE', 'README.md', 'docs/architecture.md', 'docs/hash.md', 'global.ignore', 'package.json', 'pathsift.config.json',
  ...await distFiles(path.join(root, 'dist'))
].sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(`Package file list differs.\nExpected: ${expected.join(', ')}\nActual: ${actual.join(', ')}`);
}
if (!actual.includes('dist/boot/cli-main.js') || actual.some(file => file.endsWith('.ts') || file.startsWith('src/'))) {
  throw new Error('Package must contain compiled CLI JavaScript and no TypeScript source');
}
console.log(`Package contents checked (${actual.length} files).`);
