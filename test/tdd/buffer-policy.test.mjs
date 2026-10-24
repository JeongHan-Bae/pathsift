import test from 'node:test';
import assert from 'node:assert/strict';
import { useMemoryBuffer } from '../../dist/core/buffer-policy.js';

const entry = (kind, size) => ({ kind, size });

test('memory boundary uses visible regular-file bytes and includes exactly 1 GiB', () => {
  const gib = 1073741824;
  assert.equal(useMemoryBuffer([entry('dir', gib), entry('symlink', gib)], gib), true);
  assert.equal(useMemoryBuffer([entry('file', gib)], gib), true);
  assert.equal(useMemoryBuffer([entry('file', gib), entry('file', 1)], gib), false);
  assert.equal(useMemoryBuffer([entry('file', 2), entry('file', 3)], 5), true);
  assert.equal(useMemoryBuffer([entry('file', 2), entry('file', 3)], 4), false);
});
