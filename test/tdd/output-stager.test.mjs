import test from 'node:test';
import assert from 'node:assert/strict';
import { writeAsyncOutput } from '../../dist/core/output.js';
import { BoundedOutputStager } from '../../dist/std/bounded-output-stager.js';

const tick = () => new Promise(resolve => setImmediate(resolve));

test('without a stager, a blocked sink pauses the producer', async () => {
  let produced = 0;
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  async function* source() { for (let i = 0; i < 3; i++) { produced++; yield { index: i }; } }
  const output = { serialize: value => String(value.index), async write() { await blocked; } };
  const done = writeAsyncOutput(source(), output);
  await tick();
  assert.equal(produced, 1);
  release();
  await done;
  assert.equal(produced, 3);
});

test('bounded stager retains semantic values and serializes only when the sink advances', async () => {
  let produced = 0;
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  const serialized = [];
  const written = [];
  async function* source() { for (let i = 0; i < 4; i++) { produced++; yield { index: i }; } }
  const output = {
    serialize(value) { serialized.push(value.index); return String(value.index); },
    async write(text) { written.push(text); if (text === '0') await blocked; }
  };
  const done = writeAsyncOutput(source(), output, new BoundedOutputStager(2));
  await tick();
  assert.equal(produced, 3);
  assert.deepEqual(serialized, [0]);
  release();
  await done;
  assert.deepEqual(serialized, [0, 1, 2, 3]);
  assert.deepEqual(written, ['0', '1', '2', '3']);
});

test('stager drains queued values before a producer error', async () => {
  const written = [];
  async function* source() { yield { index: 1 }; yield { index: 2 }; throw new Error('walk failed'); }
  await assert.rejects(writeAsyncOutput(source(), {
    serialize: value => String(value.index), async write(text) { written.push(text); }
  }, new BoundedOutputStager(2)), /walk failed/);
  assert.deepEqual(written, ['1', '2']);
});

test('stager cancels the producer after an output error', async () => {
  let closed = false;
  async function* source() { try { for (let i = 0; i < 100; i++) yield { index: i }; } finally { closed = true; } }
  await assert.rejects(writeAsyncOutput(source(), {
    serialize: value => String(value.index), async write() { throw new Error('output failed'); }
  }, new BoundedOutputStager(2)), /output failed/);
  assert.equal(closed, true);
});

test('stager requires a positive bounded capacity', () => {
  for (const capacity of [0, -1, 1.5, Infinity]) assert.throws(() => new BoundedOutputStager(capacity), /capacity/);
});

test('stager snapshots serializable semantic values and rejects functions', async () => {
  const item = { index: 1 };
  async function* source() { yield item; item.index = 2; yield { index: 3 }; }
  const written = [];
  await writeAsyncOutput(source(), {
    serialize: value => String(value.index), async write(text) { written.push(text); }
  }, new BoundedOutputStager(2));
  assert.deepEqual(written, ['1', '3']);
  async function* invalid() { yield Math.max; }
  await assert.rejects(writeAsyncOutput(invalid(), {
    serialize: () => 'unreachable', async write() {}
  }, new BoundedOutputStager(1)), /clone|DataCloneError/i);
});
