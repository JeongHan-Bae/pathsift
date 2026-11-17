import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { classifyFile } from '../../dist/adapters/content-classifier.js';

test('classifies bytes by content regardless of extension', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'pathsift-content-'));
  try {
    /** @type {Array<{name: string, bytes: Buffer, expected: 'text' | 'binary'}>} */
    const samples = [
      { name: 'source.bin', bytes: Buffer.from('package example;\nString signature = "%PDF-1.4";\n'), expected: 'text' },
      { name: 'empty.txt', bytes: Buffer.alloc(0), expected: 'text' },
      { name: 'utf8.txt', bytes: Buffer.from('\u4f60\u597d\uff0c\u4e16\u754c\u3002\n'), expected: 'text' },
      { name: 'utf16.txt', bytes: Buffer.from([0xff, 0xfe, 0x48, 0, 0x69, 0]), expected: 'text' },
      { name: 'large.yaml', bytes: Buffer.from('summary: \u793a\u4f8b\u6587\u5b57 `state`\uff1a\u8fd8\u6709\u4e00\u884c\u5185\u5bb9\u3002\n'.repeat(3000)), expected: 'text' },
      { name: 'large.md', bytes: Buffer.from('# \u793a\u4f8b\u6807\u9898\n\u666e\u901a\u6587\u5b57 `state`\uff1a\u8fd8\u6709\u4e00\u884c\u5185\u5bb9\u3002\n'.repeat(3000) + 'aa'), expected: 'text' },
      { name: 'data.txt', bytes: Buffer.from([0, 1, 2, 3, 4]), expected: 'binary' },
      { name: 'archive.txt', bytes: Buffer.from('504b0506000000000000000000000000000000000000', 'hex'), expected: 'binary' },
      { name: 'image.txt', bytes: Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'), expected: 'binary' },
      { name: 'late.txt', bytes: Buffer.concat([Buffer.from('A'.repeat(200000)), Buffer.from([0, 1, 2, 3])]), expected: 'binary' }
    ];
    for (const { name, bytes, expected } of samples) {
      const file = path.join(root, name);
      await writeFile(file, bytes);
      assert.equal(await classifyFile(file, bytes.length), expected, name);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
