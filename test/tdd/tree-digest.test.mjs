import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileDigestPayload, treeDigestPayload } from '../../dist/core/tree-digest.js';

const sha256 = value => createHash('sha256').update(value).digest('hex');

test('first-level digest binds the relative filename to its content digest', () => {
  const content = sha256('same bytes');
  assert.notEqual(sha256(fileDigestPayload(sha256('a.txt'), content, 1)), sha256(fileDigestPayload(sha256('b.txt'), content, 1)));
  assert.notEqual(sha256(fileDigestPayload(sha256('a.txt'), content, 1)), sha256(fileDigestPayload(sha256('a.txt'), sha256('changed bytes'), 1)));
  assert.throws(() => fileDigestPayload('short', content, 1), /Filename digest/);
  assert.throws(() => fileDigestPayload(sha256('a.txt'), 'short', 1), /Content digest/);
});

test('second-level digest combines ordered file hashes independently of traversal order', () => {
  const a = { path: 'a.txt', fileHash: sha256(fileDigestPayload(sha256('a.txt'), sha256('abc'), 1)) };
  const b = { path: 'b.txt', fileHash: sha256(fileDigestPayload(sha256('b.txt'), sha256('one'), 1)) };
  const original = treeDigestPayload([b, a], 1);
  assert.equal(treeDigestPayload([a, b], 1), original);
  assert.notEqual(treeDigestPayload([a], 1), original);
  assert.notEqual(treeDigestPayload([a, { ...b, fileHash: sha256(fileDigestPayload(sha256('b.txt'), sha256('other'), 1)) }], 1), original);
  assert.throws(() => treeDigestPayload([{ path: 'bad', fileHash: 'short' }], 1), /File digest/);
});
