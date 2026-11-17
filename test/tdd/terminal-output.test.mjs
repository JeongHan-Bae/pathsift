import test from 'node:test';
import assert from 'node:assert/strict';
import { plainOutput, printCommand, supportsInk } from '../../dist/adapters/output/terminal-output.js';
import { BoundedOutputStager } from '../../dist/std/bounded-output-stager.js';
import { EventEmitter } from 'node:events';

test('output adapter keeps pipes plain and reserves Ink for suitable TTYs', async () => {
  assert.equal(supportsInk({ isTTY: false, columns: 80 }, 'xterm'), false);
  assert.equal(supportsInk({ isTTY: true, columns: 10 }, 'xterm'), false);
  assert.equal(supportsInk({ isTTY: true, columns: 80 }, 'dumb'), false);
  assert.equal(supportsInk({ isTTY: true, columns: 80 }, 'xterm'), true);
  assert.equal(plainOutput({ kind: 'text', lines: ['first', 'second'] }), 'first\nsecond\n');
  const manifest = { kind: 'json', value: { root: '/root', entries: [] } };
  assert.deepEqual(JSON.parse(plainOutput(manifest)), manifest.value);
  let written = '';
  await printCommand(manifest, { isTTY: false, write: chunk => { written += chunk; } });
  assert.equal(written, plainOutput(manifest));
  assert.ok(!written.includes('\x1b['));
});

test('output adapter draws staged semantic tree items after stdout drains', async () => {
  let produced = 0;
  async function* chunks() {
    produced++; yield { kind: 'text', text: '/root\n', role: 'tree-root' };
    produced++; yield { kind: 'tree-line', line: { ancestorsLast: [], name: 'child', kind: 'file', lastSibling: true } };
  }
  const output = new EventEmitter();
  const written = [];
  output.isTTY = false;
  output.write = text => { written.push(text); return written.length > 1; };
  const printing = printCommand({ kind: 'stream', chunks: chunks() }, output, new BoundedOutputStager(2));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(produced, 2);
  assert.deepEqual(written, ['/root\n']);
  output.emit('drain');
  await printing;
  assert.deepEqual(written, ['/root\n', '└── child\n']);
});
