import test from 'node:test';
import assert from 'node:assert/strict';
import { plainOutput, printCommand, supportsInk } from '../../dist/adapters/output/terminal-output.js';

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
