import test from 'node:test';
import assert from 'node:assert/strict';
import { lstat, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createNodeFilesystemPorts } from '../../dist/adapters/node-filesystem.js';

async function fixture(fn) {
  const base = await mkdtemp(path.join(tmpdir(), 'pathsift-rollback-'));
  try {
    const source = path.join(base, 'source');
    await mkdir(source);
    const file = path.join(source, 'good.txt');
    await writeFile(file, 'abc');
    const stat = await lstat(file);
    const entries = [
      { path: 'good.txt', fullPath: file, kind: 'file', size: stat.size, mode: stat.mode, mtime: stat.mtime },
      { path: 'missing.txt', fullPath: path.join(source, 'missing.txt'), kind: 'file', size: 1, mode: stat.mode, mtime: stat.mtime }
    ];
    await fn({ base, entries, ports: createNodeFilesystemPorts() });
  } finally { await rm(base, { recursive: true, force: true }); }
}

async function assertAbsent(file) {
  await assert.rejects(lstat(file), { code: 'ENOENT' });
}

for (const [label, limit] of [['memory', 1024], ['direct', 1]]) {
  test(`cp ${label} failure removes a newly created destination`, async () => fixture(async ({ base, entries, ports }) => {
    const destination = path.join(base, 'new', 'copy');
    await assert.rejects(ports.copy(entries, destination, limit));
    await assertAbsent(destination);
    await assertAbsent(path.join(base, 'new'));
  }));
  test(`cp ${label} failure leaves an existing empty destination empty`, async () => fixture(async ({ base, entries, ports }) => {
    const destination = path.join(base, 'empty');
    await mkdir(destination);
    await assert.rejects(ports.copy(entries, destination, limit));
    assert.deepEqual(await readdir(destination), []);
  }));
  test(`archive ${label} failure removes a newly created destination`, async () => fixture(async ({ base, entries, ports }) => {
    const destination = path.join(base, 'new', 'out.tar');
    await assert.rejects(ports.archive(entries, destination, limit));
    await assertAbsent(destination);
    await assertAbsent(path.join(base, 'new'));
  }));
  test(`archive ${label} failure leaves an existing empty output file empty`, async () => fixture(async ({ base, entries, ports }) => {
    const destination = path.join(base, 'empty.tar');
    await writeFile(destination, '');
    await assert.rejects(ports.archive(entries, destination, limit));
    assert.equal(await readFile(destination, 'utf8'), '');
  }));
}

test('copy switches to direct writing if a file grew beyond its metadata estimate', async () => fixture(async ({ base, entries, ports }) => {
  const destination = path.join(base, 'grown');
  await ports.copy(entries.slice(0, 1).map(entry => ({ ...entry, size: 1 })), destination, 1);
  assert.equal(await readFile(path.join(destination, 'good.txt'), 'utf8'), 'abc');
}));

test('archive switches to direct writing when archive framing exceeds the memory cap', async () => fixture(async ({ base, entries, ports }) => {
  const destination = path.join(base, 'framing.tar');
  const onlyDirectory = [{ ...entries[0], path: 'empty', kind: 'dir', size: 0 }];
  await ports.archive(onlyDirectory, destination, 1);
  assert.ok((await lstat(destination)).size > 1);
}));
