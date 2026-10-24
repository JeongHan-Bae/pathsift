import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { walk, within } from '../dist/adapters/ignore-walker.js';
import { supportsTerminal } from '../dist/adapters/nano.js';

const run = promisify(execFile);
const bin = fileURLToPath(new URL('../dist/boot/cli-main.js', import.meta.url));

test('destination containment', () => {
  assert.equal(within('/tmp/source', '/tmp/source/sub'), true);
  assert.equal(within('/tmp/source', '/tmp/elsewhere'), false);
});

test('nano refuses non-TTY input', async () => {
  assert.equal(supportsTerminal({ isTTY: false }, { isTTY: false }), false);
  await assert.rejects(run(process.execPath, [bin, 'nano']), /requires a TTY/);
});

test('without ignore rules, walk and cp reproduce a directory tree', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'pathsift-test-'));
  try {
    const root = path.join(base, 'src');
    await mkdir(path.join(root, 'sub'), { recursive: true });
    await writeFile(path.join(root, 'a.txt'), 'abc');
    await writeFile(path.join(root, 'sub', 'b.txt'), 'hello');
    const entries = [];
    for await (const e of walk(root, { ignoreEnabled: false })) entries.push(e.path);
    assert.deepEqual(entries, ['a.txt', 'sub', 'sub/b.txt']);
    const destination = path.join(base, 'out');
    await run(process.execPath, [bin, 'cp', root, destination, '--no-ignore']);
    assert.equal(await readFile(path.join(destination, 'sub', 'b.txt'), 'utf8'), 'hello');
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

let hasIgnore = false;
try { await import('ignore'); hasIgnore = true; } catch { /* npm install not run */ }

test('global and nested rules with negation and directory handling', { skip: !hasIgnore }, async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'pathsift-ignore-'));
  try {
    const root = path.join(base, 'src');
    await mkdir(path.join(root, 'sub'), { recursive: true });
    await mkdir(path.join(root, 'build'), { recursive: true });
    const global = path.join(base, 'global.ignore');
    await writeFile(global, '*.log\nbuild/\n');
    await writeFile(path.join(root, '.gitignore'), '!build/\n');
    await writeFile(path.join(root, 'sub', '.gitignore'), '!keep.log\n');
    for (const filename of ['a.txt', 'b.log', 'build/ok.txt', 'sub/keep.log', 'sub/no.log']) {
      await writeFile(path.join(root, filename), filename);
    }
    const paths = [];
    for await (const e of walk(root, { globalPath: global })) paths.push(e.path);
    assert.ok(paths.includes('build/ok.txt'), 'root level negation rescues global folder');
    assert.ok(paths.includes('sub/keep.log'), 'nested negation rescues ignored file');
    assert.ok(!paths.includes('sub/no.log'));
    assert.ok(!paths.includes('b.log'));
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
