import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { walk } from '../../dist/adapters/ignore-walker.js';

/** @type {(root: string, options: { ignoreEnabled: boolean, maxDepth: number }) => AsyncIterable<{ path: string }>} */
const scanAtDepth = walk;

test('maxDepth prevents readdir beneath the selected level', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pathsift-depth-'));
  const original = fs.readdir;
  const descriptor = Object.getOwnPropertyDescriptor(fs, 'readdir');
  assert.ok(descriptor);
  const opened = [];
  try {
    await fs.mkdir(path.join(root, 'nested'));
    await fs.writeFile(path.join(root, 'nested', 'hidden.txt'), '');
    Object.defineProperty(fs, 'readdir', {
      ...descriptor,
      value: async (...args) => { opened.push(args[0]); return Reflect.apply(original, fs, args); }
    });
    const paths = [];
    for await (const item of scanAtDepth(root, { ignoreEnabled: false, maxDepth: 1 })) paths.push(item.path);
    assert.deepEqual(paths, ['nested']);
    assert.deepEqual(opened, [await fs.realpath(root)]);
    opened.length = 0;
    const zero = [];
    for await (const item of scanAtDepth(root, { ignoreEnabled: false, maxDepth: 0 })) zero.push(item.path);
    assert.deepEqual(zero, []);
    assert.deepEqual(opened, []);
  } finally {
    Object.defineProperty(fs, 'readdir', descriptor);
    await fs.rm(root, { recursive: true, force: true });
  }
});
