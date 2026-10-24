import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const publishedFields = [
  'name', 'version', 'description', 'keywords', 'license', 'type',
  'repository', 'bugs', 'homepage', 'bin', 'engines', 'publishConfig',
  'dependencies', 'files'
];

export async function preparePackage(parent) {
  const source = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  if (source.private !== true) throw new Error('Repository root must remain private');
  if (!Array.isArray(source.files) || !source.files.includes('README.md')) {
    throw new Error('Package files must include README.md');
  }
  const directory = path.join(parent, 'package-input');
  await mkdir(directory);
  for (const entry of source.files) {
    const relative = entry.replace(/\/$/, '');
    if (!relative || path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) {
      throw new Error(`Unsafe package file entry: ${entry}`);
    }
    const from = path.join(root, relative === 'README.md' ? 'docs/npm-readme.md' : relative);
    const to = path.join(directory, relative);
    await mkdir(path.dirname(to), { recursive: true });
    await cp(from, to, { recursive: true });
  }
  const published = Object.fromEntries(publishedFields.map(key => [key, source[key]]).filter(([, value]) => value !== undefined));
  await writeFile(path.join(directory, 'package.json'), JSON.stringify(published, null, 2) + '\n');
  return directory;
}
