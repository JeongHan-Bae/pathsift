import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { walk } from '../../dist/adapters/ignore-walker.js';

test('rescuing one directory does not mutate ignore rules for its siblings', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'pathsift-isolation-'));
  try {
    const root = path.join(base, 'root');
    await mkdir(path.join(root, 'build'), { recursive: true });
    await mkdir(path.join(root, 'other', 'build'), { recursive: true });
    await writeFile(path.join(base, 'global.ignore'), 'build/\n');
    await writeFile(path.join(root, '.gitignore'), '!/build/\n');
    await writeFile(path.join(root, 'build', 'visible'), 'yes');
    await writeFile(path.join(root, 'other', 'build', 'hidden'), 'no');
    const paths = [];
    for await (const entry of walk(root, { globalPath: path.join(base, 'global.ignore') })) paths.push(entry.path);
    assert.ok(paths.includes('build/visible'));
    assert.ok(!paths.includes('other/build'));
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
