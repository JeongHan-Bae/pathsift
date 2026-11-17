import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function createAncestorLayout(base) {
  const parent = path.join(base, 'parent');
  const middle = path.join(parent, 'middle');
  const target = path.join(middle, 'target');
  await mkdir(target, { recursive: true });
  await writeFile(path.join(parent, '.gitignore'), 'middle/target/outer.txt\n');
  await writeFile(path.join(parent, '.deployignore'), 'middle/target/second.txt\n');
  await writeFile(path.join(middle, '.gitignore'), 'target/middle.txt\n');
  return { parent, middle, target };
}
