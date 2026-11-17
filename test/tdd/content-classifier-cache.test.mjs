import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { WASMagic } from 'wasmagic';
import { classifyFile } from '../../dist/adapters/content-classifier.js';

test('content adapter initializes the detection engine once for multiple files', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'pathsift-magic-cache-'));
  const original = WASMagic.create;
  let created = 0;
  WASMagic.create = async options => { created++; return original.call(WASMagic, options); };
  try {
    const first = path.join(root, 'first');
    const second = path.join(root, 'second');
    await writeFile(first, 'plain text one\n');
    await writeFile(second, 'plain text two\n');
    assert.equal(await classifyFile(first, 15), 'text');
    assert.equal(await classifyFile(second, 15), 'text');
    assert.equal(created, 1);
  } finally { WASMagic.create = original; await rm(root, { recursive: true, force: true }); }
});
