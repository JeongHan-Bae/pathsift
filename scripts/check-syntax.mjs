import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const files = [];
async function collect(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) await collect(full);
    else if (/\.(?:mjs|cjs)$/.test(entry.name)) files.push(full);
  }
}
for (const folder of ['bin', 'scripts', 'test']) await collect(path.join(root, folder));
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${path.relative(root, file)} syntax check failed:\n${result.stderr}`);
}
console.log(`JavaScript syntax checks passed (${files.length} files).`);
