import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, symlink, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { walk } from '../../dist/adapters/ignore-walker.js';
import { createNodeFilesystemPorts } from '../../dist/adapters/node-filesystem.js';

test('collects ignore files along the selected parent-to-root path only', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'pathsift-ancestor-'));
  try {
    const parent = path.join(base, 'parent');
    const middle = path.join(parent, 'middle');
    const target = path.join(middle, 'target');
    await mkdir(target, { recursive: true });
    await writeFile(path.join(parent, '.gitignore'), 'middle/target/outer.txt\n');
    await writeFile(path.join(parent, '.deployignore'), 'middle/target/second.txt\n');
    await writeFile(path.join(middle, '.gitignore'), 'target/middle.txt\n');
    await writeFile(path.join(target, '.gitignore'), 'local.txt\n');
    for (const name of ['outer.txt', 'middle.txt', 'second.txt', 'local.txt', 'visible.txt']) {
      await writeFile(path.join(target, name), name);
    }
    const names = async options => {
      const result = [];
      for await (const entry of walk(target, options)) result.push(entry.path);
      return result.sort();
    };
    assert.deepEqual(await names({}), ['.gitignore', 'middle.txt', 'outer.txt', 'second.txt', 'visible.txt']);
    assert.deepEqual(await names({ parentPath: middle }), ['.gitignore', 'outer.txt', 'second.txt', 'visible.txt']);
    assert.deepEqual(await names({ parentPath: parent, ignoreFiles: ['.gitignore', '.deployignore'] }), ['.gitignore', 'visible.txt']);
    assert.deepEqual(await names({ parentPath: parent, ignoreEnabled: false }), ['.gitignore', 'local.txt', 'middle.txt', 'outer.txt', 'second.txt', 'visible.txt']);
    const alias = path.join(base, 'alias');
    await symlink(parent, alias, process.platform === 'win32' ? 'junction' : 'dir');
    const aliasedTarget = path.join(alias, 'middle', 'target');
    assert.equal(await createNodeFilesystemPorts().isWithin(parent, aliasedTarget), true);
    const aliasedNames = [];
    for await (const entry of walk(aliasedTarget, { parentPath: parent })) aliasedNames.push(entry.path);
    assert.deepEqual(aliasedNames.sort(), ['.gitignore', 'second.txt', 'visible.txt']);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
