import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { WASMagic } from 'wasmagic';
import { classifyFile } from '../../dist/adapters/content-classifier.js';

test('failed WASM initialization is not cached', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'pathsift-magic-retry-'));
  const original = WASMagic.create;
  let created = 0;
  WASMagic.create = async () => {
    created++;
    if (created === 1) throw new Error('initialization failed');
    return original.call(WASMagic);
  };
  try {
    const file = path.join(root, 'sample');
    await writeFile(file, 'sample');
    await assert.rejects(classifyFile(file, 6), /initialization failed/);
    assert.equal(await classifyFile(file, 6), 'text');
    assert.equal(created, 2);
  } finally { WASMagic.create = original; await rm(root, { recursive: true, force: true }); }
});
