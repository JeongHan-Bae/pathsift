import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree } from '../../dist/core/tree.js';

test('tree structure groups directories before name-sorted files at every level', () => {
  const entries = [
    { path: 'z.txt', kind: 'file' },
    { path: 'z-dir/z.txt', kind: 'file' },
    { path: 'b-dir', kind: 'dir' },
    { path: 'b-dir/z.txt', kind: 'file' },
    { path: 'b-dir/z-sub', kind: 'dir' },
    { path: 'b-dir/a-sub', kind: 'dir' },
    { path: 'b-dir/a.txt', kind: 'file' },
    { path: 'a-dir', kind: 'dir' },
    { path: 'a.txt', kind: 'file' },
    { path: 'link', kind: 'symlink' },
    { path: 'z-dir', kind: 'dir' }
  ];
  const tree = buildTree(entries);
  assert.deepEqual(tree.map(node => node.name), ['a-dir', 'b-dir', 'z-dir', 'a.txt', 'link', 'z.txt']);
  assert.deepEqual(tree.find(node => node.name === 'b-dir').children.map(node => node.name), [
    'a-sub', 'z-sub', 'a.txt', 'z.txt'
  ]);
  assert.equal(tree.find(node => node.name === 'link').kind, 'symlink');
  assert.deepEqual(entries[0], { path: 'z.txt', kind: 'file' });
});

test('empty input builds an empty tree', () => {
  assert.deepEqual(buildTree([]), []);
});
