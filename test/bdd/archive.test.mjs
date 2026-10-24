import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { matrix, withFixture, kind, assertCliError } from './support/fixture.mjs';

const exec = promisify(execFile);
const archivePaths = variant => variant.paths.map(p => kind(p) === 'dir' ? `${p}/` : p);
const configWithLimit = bytes => JSON.stringify({ ignoreFiles: ['.gitignore'], globalIgnore: 'global.ignore', hashVersion: 1, bufferLimitBytes: bytes });

async function assertTarContents(file, variant) {
  const listing = (await exec('tar', ['-tf', file])).stdout.trimEnd().split('\n');
  assert.deepEqual(listing.sort(), archivePaths(variant).sort());
  const symlinkDetail = (await exec('tar', ['-tvf', file])).stdout;
  assert.match(symlinkDetail, /link-to-sub -> sub/);
}

describe('archive', () => {
  for (const variant of matrix) it(variant.name, async () => withFixture(variant, async ({ base, source, invoke }) => {
    const destination = path.join(base, 'out.tar');
    const { stdout, stderr } = await invoke('archive', source, destination, ...variant.flags);
    assert.equal(stderr, '');
    assert.match(stdout, /^Created .*out\.tar \(\d+ bytes\)\n$/);
    await assertTarContents(destination, variant);
  }));
  for (const extension of ['tar.gz', 'tgz']) it(`creates ${extension}`, async () => withFixture(matrix[2], async ({ base, source, invoke }) => {
    const destination = path.join(base, `out.${extension}`);
    await invoke('archive', source, destination, ...matrix[2].flags);
    await assertTarContents(destination, matrix[2]);
  }));
  it('creates zip with only visible entries', async () => withFixture(matrix[2], async ({ base, source, invoke }) => {
    const destination = path.join(base, 'out.zip');
    await invoke('archive', source, destination, ...matrix[2].flags);
    const listing = (await exec('unzip', ['-Z', '-1', destination])).stdout.trimEnd().split('\n');
    assert.deepEqual(listing.sort(), archivePaths(matrix[2]).sort());
  }));
  it('archives into a missing file inside the source without self-inclusion', async () => withFixture(matrix[0], async ({ source, invoke }) => {
    const destination = path.join(source, 'out.tar');
    await invoke('archive', source, destination);
    await assertTarContents(destination, matrix[0]);
  }));
  it('archives into an existing empty file inside the source without self-inclusion', async () => withFixture(matrix[0], async ({ source, invoke }) => {
    const destination = path.join(source, 'out.tar');
    await writeFile(destination, '');
    await invoke('archive', source, destination);
    await assertTarContents(destination, matrix[0]);
  }));
  it('refuses a nonempty output before scanning', async () => withFixture(matrix[0], async ({ source, invoke }) => {
    const destination = path.join(source, 'out.tar');
    await writeFile(destination, 'untouched');
    await assertCliError(invoke('archive', source, destination), /Output is not empty/);
    assert.equal(await readFile(destination, 'utf8'), 'untouched');
  }));
  it('streams directly when visible regular files exceed the buffer limit', async () => withFixture(matrix[0], async ({ base, packageDir, source, invoke }) => {
    await writeFile(path.join(packageDir, 'pathsift.config.json'), configWithLimit(2));
    const destination = path.join(base, 'direct.tar');
    await invoke('archive', source, destination);
    await assertTarContents(destination, matrix[0]);
  }));
  it('requires force for parent-relative source or destination', async () => withFixture(matrix[0], async ({ base, source, invokeIn }) => {
    const cwd = path.join(base, 'child');
    await mkdir(cwd);
    await assertCliError(invokeIn(cwd, 'archive', '../source', './out.tar'), /Relative parent path requires --force/);
    await assertCliError(invokeIn(cwd, 'archive', source, '../out.tar'), /Relative parent path requires --force/);
    await invokeIn(cwd, 'archive', '../source', '../out.tar', '--force');
    await assertTarContents(path.join(base, 'out.tar'), matrix[0]);
  }));
  it('refuses bad extension or non-file output and accepts a symlink-routed child', async () => withFixture(matrix[0], async ({ base, source, invoke }) => {
    await assertCliError(invoke('archive', source, path.join(base, 'out.bin')), /must end with/);
    const directory = path.join(base, 'directory.tar');
    await mkdir(directory);
    await assertCliError(invoke('archive', source, directory), /Output must be an empty regular file/);
    const alias = path.join(base, 'alias');
    await symlink(source, alias, 'dir');
    await invoke('archive', source, path.join(alias, 'inside.tar'));
    await assertTarContents(path.join(source, 'inside.tar'), matrix[0]);
    await assertCliError(invoke('archive', source), /requires source directory and destination/);
  }));
});
