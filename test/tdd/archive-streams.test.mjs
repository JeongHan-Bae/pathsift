import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { writeArchive } from '../../dist/adapters/archive-streams.js';

async function fixture(fn) {
  const root = await mkdtemp(path.join(tmpdir(), 'pathsift-archive-streams-'));
  try {
    const file = path.join(root, 'good.txt');
    await writeFile(file, 'abc');
    const stat = await lstat(file);
    const entry = { path: 'good.txt', fullPath: file, kind: 'file', size: 3, mode: stat.mode, mtime: stat.mtime };
    await fn({ root, entry });
  } finally { await rm(root, { recursive: true, force: true }); }
}

for (const format of ['zip', 'tar', 'tar.gz']) {
  test(`${format} waits for successful output completion`, async () => fixture(async ({ entry }) => {
    const chunks = [];
    const output = new Writable({ write(chunk, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } });
    const bytes = await writeArchive([entry], format, output);
    assert.equal(output.writableFinished, true);
    assert.equal(bytes, Buffer.concat(chunks).length);
    assert.ok(bytes > 0);
  }));
  test(`${format} terminates streams on input failure`, async () => fixture(async ({ root, entry }) => {
    const missing = { ...entry, path: 'missing.txt', fullPath: path.join(root, 'missing.txt') };
    const output = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
    await assert.rejects(writeArchive([entry, missing], format, output));
    assert.equal(output.destroyed, true);
  }));
  test(`${format} terminates streams on output failure`, async () => fixture(async ({ entry }) => {
    const output = new Writable({ write(_chunk, _encoding, callback) { callback(new Error('output failed')); } });
    await assert.rejects(writeArchive([entry], format, output), /output failed/);
    assert.equal(output.destroyed, true);
  }));
}

test('tar rejects a file whose byte length differs from walker metadata', async () => fixture(async ({ entry }) => {
  const output = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  await assert.rejects(writeArchive([{ ...entry, size: 5 }], 'tar', output));
  assert.equal(output.destroyed, true);
}));
