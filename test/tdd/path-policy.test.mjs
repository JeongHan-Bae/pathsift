import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { requiresForce } from '../../dist/core/path-policy.js';

test('relative parent segments require force even when normalization returns inside cwd', () => {
  for (const input of ['..', '../sibling', './../sibling', 'a/../b']) {
    assert.equal(requiresForce(input, path.isAbsolute), true, input);
  }
  for (const input of ['.', './child', 'child/grandchild', path.resolve('/tmp', '../other')]) {
    assert.equal(requiresForce(input, path.isAbsolute), false, input);
  }
});
