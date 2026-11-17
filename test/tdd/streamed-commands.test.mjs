import test from 'node:test';
import assert from 'node:assert/strict';
import { runCommand } from '../../dist/application/run.js';
import { writeAsyncOutput } from '../../dist/core/output.js';

const config = { ignoreFiles: ['.gitignore'], globalPath: '/global.ignore', hashVersion: 1, bufferLimitBytes: 1 };
const file = (name, kind, lastSibling) => ({ path: name, fullPath: `/root/${name}`, kind, size: 2, mode: 0o644, mtime: new Date(), lastSibling });
const entries = [file('b', 'dir', false), file('b/z.txt', 'file', true), file('a.txt', 'file', true)];

function ports(onNext = () => {}) {
  return {
    resolve: value => value, isAbsolute: () => false, isWithin: async () => true, isSimpleFilename: () => true,
    async *walk(_root, options) {
      assert.equal(options.treeOrder, true);
      for (const [index, entry] of entries.entries()) { if (index) onNext(index); yield entry; }
    }
  };
}

test('tree streams lines with an ancestor stack and waits for the async output port', async () => {
  let firstEntryWritten = false;
  const output = await runCommand({ cmd: 'tree', args: ['root'], opts: {}, config }, ports(index => {
    if (index === 1) assert.equal(firstEntryWritten, true);
  }));
  const chunks = [];
  await writeAsyncOutput(output.chunks, { serialize(chunk) { return JSON.stringify(chunk); }, async write(text) {
    const chunk = JSON.parse(text);
    chunks.push(chunk);
    if (chunk.kind === 'tree-line' && chunk.line.name === 'b') firstEntryWritten = true;
  } });
  assert.deepEqual(chunks.map(chunk => chunk.kind), ['text', 'tree-line', 'tree-line', 'tree-line', 'text']);
  assert.deepEqual(chunks[2].line.ancestorsLast, [false]);
  assert.equal(chunks[2].line.name, 'z.txt');
  assert.equal(chunks[4].text, '1 directories, 2 files, 4 file bytes\n');
});

test('where, ls, hash, manifest, count, and du produce async chunks', async () => {
  for (const cmd of ['where', 'ls', 'hash', 'manifest', 'count', 'du']) {
    const adapter = {
      ...ports(),
      async *walk() { yield* entries; },
      hash: async () => 'b'.repeat(64), digest: () => 'a'.repeat(64)
    };
    const result = await runCommand({ cmd, args: cmd === 'where' ? ['z.txt'] : ['root'], opts: {}, config }, adapter);
    assert.equal(result.kind, 'stream');
    const chunks = await Array.fromAsync(result.chunks);
    assert.ok(chunks.length > 0);
    if (cmd === 'manifest') assert.equal(JSON.parse(chunks.map(chunk => chunk.text).join('')).entries.length, 3);
    if (cmd === 'where') assert.equal(chunks.map(chunk => chunk.text).join(''), 'b/z.txt\n');
    if (cmd === 'count') assert.equal(chunks[0].text, '1 directories, 2 files, 4 file bytes\n');
    if (cmd === 'du') assert.equal(chunks[0].text, '4\troot\n');
  }
});
