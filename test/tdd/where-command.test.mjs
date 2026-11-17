import test from 'node:test';
import assert from 'node:assert/strict';
import { runCommand } from '../../dist/application/run.js';
import { selectWhereMode } from '../../dist/boot/where-options.js';

test('mode selection defaults to exact, permits repeats, and rejects conflicts', () => {
  assert.equal(selectWhereMode({}), 'exact');
  for (const mode of ['exact', 'contains', 'glob']) {
    assert.equal(selectWhereMode({ [mode]: [true] }), mode);
    assert.equal(selectWhereMode({ [mode]: [true, true] }), mode);
  }
  assert.throws(() => selectWhereMode({ exact: [true], contains: [true] }), /mutually exclusive/);
});

test('where uses one injected walk, checks basenames, and never reads file content', async () => {
  const walked = [];
  const entries = [
    { path: 'config.ts', kind: 'dir' }, { path: 'src/config.ts', kind: 'file' },
    { path: 'src/Config.ts', kind: 'file' }, { path: 'src/link.ts', kind: 'symlink' },
    { path: 'tests/config.ts', kind: 'file' }
  ];
  const ports = {
    resolve: value => `/root/${value}`,
    isAbsolute: value => value.startsWith('/'),
    isWithin: async () => true,
    isSimpleFilename: value => !value.includes('/'),
    async *walk(root, options) { walked.push({ root, options }); yield* entries; },
    hash: () => { throw new Error('must not read content'); },
    digest: () => { throw new Error('must not digest'); }
  };
  const config = { ignoreFiles: ['.gitignore'], globalPath: '/global.ignore', hashVersion: 1, bufferLimitBytes: 1 };
  const result = await runCommand({ cmd: 'where', args: ['project', 'config.ts'], opts: {}, config }, ports);
  assert.equal(result.kind, 'stream');
  assert.deepEqual((await Array.fromAsync(result.chunks)).map(chunk => chunk.text), ['src/config.ts\n', 'tests/config.ts\n']);
  assert.equal(walked.length, 1);
  assert.equal(walked[0].root, '/root/project');
  assert.equal(walked[0].options.ignoreEnabled, true);
  assert.deepEqual(await Array.fromAsync((await runCommand({ cmd: 'where', args: ['absent'], opts: {}, config }, ports)).chunks), []);
  assert.equal(walked[1].root, '/root/.');
});

test('where propagates walker failure', async () => {
  const ports = {
    resolve: value => value,
    isAbsolute: () => false,
    isWithin: async () => true,
    isSimpleFilename: () => true,
    async *walk() { throw new Error('walk failed'); }
  };
  const config = { ignoreFiles: ['.gitignore'], globalPath: '/global.ignore', hashVersion: 1, bufferLimitBytes: 1 };
  const result = await runCommand({ cmd: 'where', args: ['x'], opts: {}, config }, ports);
  await assert.rejects(Array.fromAsync(result.chunks), /walk failed/);
});
