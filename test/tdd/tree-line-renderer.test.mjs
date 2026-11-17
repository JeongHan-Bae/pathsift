import test from 'node:test';
import assert from 'node:assert/strict';
import { TreeLineStack } from '../../dist/std/tree-line-stack.js';
import { TreeLineRenderer } from '../../dist/adapters/output/tree-line-renderer.js';

test('standard tree stack returns structure and drawing class owns glyphs', () => {
  const stack = new TreeLineStack();
  const renderer = new TreeLineRenderer();
  const parent = stack.line({ path: 'docs', kind: 'dir', lastSibling: false });
  const child = stack.line({ path: 'docs/readme.md', kind: 'file', lastSibling: true });
  const last = stack.line({ path: 'link', kind: 'symlink', lastSibling: true });
  assert.deepEqual(parent, { ancestorsLast: [], name: 'docs', kind: 'dir', lastSibling: false });
  assert.deepEqual(child.ancestorsLast, [false]);
  assert.equal(renderer.render(parent), '├── docs/\n');
  assert.equal(renderer.render(child), '│   └── readme.md\n');
  assert.equal(renderer.render(last), '└── link@\n');
  assert.equal(renderer.renderRoot('/root', false), '/root\n');
  assert.match(renderer.renderRoot('/root', true), /\x1b\[36m\/root/);
});
