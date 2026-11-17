import test from 'node:test';
import assert from 'node:assert/strict';
import { runCommand } from '../../dist/application/run.js';
import { parseFindOptions } from '../../dist/core/find-filter.js';
import { printCommand } from '../../dist/adapters/output/terminal-output.js';
import { EventEmitter } from 'node:events';

const now = Date.parse('2026-11-16T00:00:00Z');
const entry = (path, kind, size) => ({ path, fullPath: `/root/${path}`, kind, size, mtime: new Date(now - 1000) });
const entries = [entry('src', 'dir', 0), entry('src/a.ts', 'file', 5), entry('src/b.ts', 'file', 0), entry('src/link.ts', 'symlink', 5)];
const config = { ignoreFiles: ['.gitignore'], globalPath: '/global.ignore', hashVersion: 1, bufferLimitBytes: 1 };

test('find applies AND filters to one visible walker stream and passes maxDepth to the port', async () => {
  const walks = [];
  const ports = {
    resolve: value => value,
    isAbsolute: () => false,
    isWithin: async () => true,
    isSimpleFilename: () => true,
    async *walk(root, options) { walks.push({ root, options }); yield* entries; },
    hash: () => { throw new Error('find must not read content'); }
  };
  const findFilter = parseFindOptions({ type: ['file'], name: ['*.ts'], 'min-depth': ['2'], 'max-depth': ['2'], 'min-size': ['1B'] }, now);
  const filtered = await runCommand({ cmd: 'find', args: ['root'], opts: { findFilter }, config }, ports);
  assert.equal(filtered.kind, 'stream');
  assert.deepEqual(await Array.fromAsync(filtered.chunks), [{ kind: 'text', text: 'src/a.ts\n' }]);
  assert.equal(walks.length, 1);
  assert.equal(walks[0].options.maxDepth, 2);
  const defaultResult = await runCommand({ cmd: 'find', args: ['root'], opts: {}, config }, ports);
  assert.equal(defaultResult.kind, 'stream');
  assert.deepEqual((await Array.fromAsync(defaultResult.chunks)).map(chunk => chunk.text), ['src/\n', 'src/a.ts\n', 'src/b.ts\n', 'src/link.ts\n']);
  assert.equal(walks[1].options.maxDepth, undefined);
});

test('find exposes a match before a later walker error', async () => {
  const ports = {
    resolve: value => value,
    isAbsolute: () => false,
    isWithin: async () => true,
    isSimpleFilename: () => true,
    async *walk() { yield entries[0]; throw new Error('read failed'); }
  };
  const result = await runCommand({ cmd: 'find', args: ['root'], opts: {}, config }, ports);
  const iterator = result.chunks[Symbol.asyncIterator]();
  assert.deepEqual(await iterator.next(), { value: { kind: 'text', text: 'src/\n' }, done: false });
  await assert.rejects(iterator.next(), /read failed/);
});

test('find filters entry metadata without content access', async () => {
  const ports = {
    resolve: value => value,
    isAbsolute: () => false,
    isWithin: async () => true,
    isSimpleFilename: () => true,
    async *walk() { yield* entries; },
    hash() { throw new Error('find must not read content'); }
  };
  const findFilter = parseFindOptions({ type: ['file'], name: ['*.ts'], 'min-size': ['1B'] }, now);
  const result = await runCommand({ cmd: 'find', args: ['root'], opts: { findFilter }, config }, ports);
  assert.deepEqual((await Array.fromAsync(result.chunks)).map(chunk => chunk.text), ['src/a.ts\n']);
  await Array.fromAsync((await runCommand({ cmd: 'find', args: ['root'], opts: {}, config }, ports)).chunks);
});

test('content types classify only matching regular files through the injected port', async () => {
  const classified = [];
  const classifyFile = async (file, size) => {
    classified.push({ file, size });
    return file.endsWith('a.ts') ? 'text' : 'binary';
  };
  const ports = {
    resolve: value => value, isAbsolute: () => false, isWithin: async () => true, isSimpleFilename: () => true,
    async *walk() { yield* entries; },
    classifyFile
  };
  const findFilter = parseFindOptions({ type: ['text'], name: ['*.ts'], 'min-size': ['1B'] }, now);
  const result = await runCommand({ cmd: 'find', args: ['root'], opts: { findFilter }, config }, ports);
  assert.deepEqual((await Array.fromAsync(result.chunks)).map(chunk => chunk.text), ['src/a.ts\n']);
  assert.deepEqual(classified, [{ file: '/root/src/a.ts', size: 5 }]);
});

test('find prints first result before requesting the next entry', async () => {
  let firstPrinted = false;
  const ports = {
    resolve: value => value, isAbsolute: () => false, isWithin: async () => true, isSimpleFilename: () => true,
    async *walk() { yield entries[1]; assert.equal(firstPrinted, true); yield entries[2]; }
  };
  const result = await runCommand({ cmd: 'find', args: ['root'], opts: {}, config }, ports);
  let text = '';
  await printCommand(result, { isTTY: false, write(chunk) { text += chunk; firstPrinted = true; return true; } });
  assert.equal(text, 'src/a.ts\nsrc/b.ts\n');
});

test('find waits for stdout drain before reading the next match', async () => {
  let nextRequested = false;
  const ports = {
    resolve: value => value, isAbsolute: () => false, isWithin: async () => true, isSimpleFilename: () => true,
    async *walk() { yield entries[1]; nextRequested = true; yield entries[2]; }
  };
  const output = new EventEmitter();
  let written = 0;
  output.write = () => { written++; return written > 1; };
  const result = await runCommand({ cmd: 'find', args: ['root'], opts: {}, config }, ports);
  const printing = printCommand(result, output);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(written, 1);
  assert.equal(nextRequested, false);
  output.emit('drain');
  await printing;
  assert.equal(written, 2);
  assert.equal(nextRequested, true);
});

test('find stops cleanly when a downstream pipe closes', async () => {
  let requestedSecond = false;
  const ports = {
    resolve: value => value, isAbsolute: () => false, isWithin: async () => true, isSimpleFilename: () => true,
    async *walk() { yield entries[1]; requestedSecond = true; yield entries[2]; }
  };
  const output = new EventEmitter();
  output.write = () => { queueMicrotask(() => output.emit('error', Object.assign(new Error('closed pipe'), { code: 'EPIPE' }))); return false; };
  const result = await runCommand({ cmd: 'find', args: ['root'], opts: {}, config }, ports);
  await printCommand(result, output);
  assert.equal(requestedSecond, false);
});
