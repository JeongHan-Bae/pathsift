import test from 'node:test';
import assert from 'node:assert/strict';
import { lstat, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCommand } from '../../dist/application/run.js';
import { createNodeFilesystemPorts } from '../../dist/adapters/node-filesystem.js';

async function fixture(fn) {
  const base = await mkdtemp(path.join(tmpdir(), 'pathsift-portable-'));
  try {
    const source = path.join(base, 'c');
    await mkdir(source);
    await writeFile(path.join(source, 'one.txt'), 'abc');
    const config = { ignoreFiles: ['.gitignore'], globalPath: path.join(base, 'missing.ignore'), hashVersion: 1, bufferLimitBytes: 1 };
    const ports = createNodeFilesystemPorts();
    await fn({ source, config, ports });
  } finally { await rm(base, { recursive: true, force: true }); }
}

test('direct copy can create a missing child directory without self-copying', async () => fixture(async ({ source, config, ports }) => {
  const destination = path.join(source, 'a');
  await runCommand({ cmd: 'cp', args: [source, destination], opts: {}, config }, ports);
  assert.equal(await readFile(path.join(destination, 'one.txt'), 'utf8'), 'abc');
  assert.ok(!(await readdir(destination)).includes('a'));
}));

test('direct archive can target an empty file inside the source without self-inclusion', async () => fixture(async ({ source, config, ports }) => {
  const destination = path.join(source, 'out.tar');
  await writeFile(destination, '');
  await runCommand({ cmd: 'archive', args: [source, destination], opts: {}, config }, ports);
  assert.ok((await lstat(destination)).size > 0);
  const header = await readFile(destination);
  assert.equal(header.subarray(0, 7).toString(), 'one.txt');
}));

test('direct copy can fill an existing empty child directory', async () => fixture(async ({ source, config, ports }) => {
  const destination = path.join(source, 'a');
  await mkdir(destination);
  await runCommand({ cmd: 'cp', args: [source, destination], opts: {}, config }, ports);
  assert.equal(await readFile(path.join(destination, 'one.txt'), 'utf8'), 'abc');
  assert.ok(!(await readdir(destination)).includes('a'));
}));

test('direct archive can create a missing output file inside the source', async () => fixture(async ({ source, config, ports }) => {
  const destination = path.join(source, 'out.tar');
  await runCommand({ cmd: 'archive', args: [source, destination], opts: {}, config }, ports);
  assert.ok((await lstat(destination)).size > 0);
  const header = await readFile(destination);
  assert.equal(header.subarray(0, 7).toString(), 'one.txt');
}));
