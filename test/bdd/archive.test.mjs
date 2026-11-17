import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, lstat, mkdir, readFile, symlink, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { matrix, withFixture, withParentFixture, withParentMatrixFixture, parentModes, parentModeSpellings, parentMatrixPaths, parentPaths, kind, assertCliError } from './support/fixture.mjs';

const exec = (command, args) => ({ stdout: execFileSync(command, args, { encoding: 'utf8' }) });
const archivePaths = variant => variant.paths.map(p => kind(p) === 'dir' ? `${p}/` : p);
const configWithLimit = bytes => JSON.stringify({ ignoreFiles: ['.gitignore'], globalIgnore: 'global.ignore', hashVersion: 1, bufferLimitBytes: bytes });

async function assertTarContents(file, variant) {
  const listing = (await exec('tar', ['-tf', file])).stdout.trimEnd().split('\n');
  assert.deepEqual(listing.sort(), archivePaths(variant).sort());
  const symlinkDetail = (await exec('tar', ['-tvf', file])).stdout;
  assert.match(symlinkDetail, /link-to-sub -> sub/);
}

describe('archive', () => {
  for (const variant of matrix) for (const mode of parentModes) it(`${variant.name} / ${mode.name} parent`, async () => withParentMatrixFixture(variant, async ({ base, source, invoke }) => {
    const selected = { ...variant, paths: parentMatrixPaths(variant, mode) };
    for (const spelling of parentModeSpellings(mode, base)) {
      const destination = path.join(base, `out-${mode.name}-${spelling.name}.tar`);
      const { stdout, stderr } = await invoke('archive', source, destination, ...variant.flags, ...spelling.flags);
      assert.equal(stderr, '', spelling.name);
      assert.match(stdout, /^Created .*out-(omitted|empty|explicit)-(omitted|explicit|value|bare|terminator|option)\.tar \(\d+ bytes\)\n$/, spelling.name);
      await assertTarContents(destination, selected);
    }
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
  for (const extension of ['zip', 'tar', 'tar.gz']) it(`preserves empty entries, link targets, and file metadata in ${extension}`, async () => withFixture(matrix[0], async ({ base, source, invoke }) => {
    const nested = path.join(source, 'metadata');
    await mkdir(nested);
    await mkdir(path.join(nested, 'empty'));
    await writeFile(path.join(nested, 'empty.txt'), '');
    await writeFile(path.join(nested, 'data.txt'), 'payload');
    await chmod(path.join(nested, 'data.txt'), 0o640);
    await utimes(path.join(nested, 'data.txt'), new Date('2024-02-03T04:05:06Z'), new Date('2024-02-03T04:05:06Z'));
    await symlink('data.txt', path.join(nested, 'data-link'));
    const destination = path.join(base, `metadata.${extension}`);
    await invoke('archive', source, destination);
    const listing = extension === 'zip'
      ? (await exec('unzip', ['-Z', '-1', destination])).stdout
      : (await exec('tar', ['-tf', destination])).stdout;
    for (const name of ['metadata/', 'metadata/empty/', 'metadata/empty.txt', 'metadata/data.txt', 'metadata/data-link']) {
      assert.ok(listing.split('\n').includes(name), `${extension}: ${name}`);
    }
    const data = extension === 'zip'
      ? (await exec('unzip', ['-p', destination, 'metadata/data.txt'])).stdout
      : (await exec('tar', ['-xOf', destination, 'metadata/data.txt'])).stdout;
    assert.equal(data, 'payload');
    const link = extension === 'zip'
      ? (await exec('unzip', ['-p', destination, 'metadata/data-link'])).stdout
      : (await exec('tar', ['-tvf', destination, 'metadata/data-link'])).stdout;
    assert.match(link, /data.txt/);
    const detail = extension === 'zip'
      ? (await exec('unzip', ['-Z', '-v', destination])).stdout
      : (await exec('tar', ['-tvf', destination, 'metadata/data.txt'])).stdout;
    assert.match(detail, /2024|Feb\s+3/);
    if (process.platform !== 'win32') assert.match(detail, extension === 'zip' ? /100640/ : /-rw-r-----/);
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
  for (const extension of ['zip', 'tar', 'tar.gz']) it(`streams ${extension} directly when visible regular files exceed the buffer limit`, async () => withFixture(matrix[0], async ({ base, packageDir, source, invoke }) => {
    await writeFile(path.join(packageDir, 'pathsift.config.json'), configWithLimit(2));
    const destination = path.join(base, `direct.${extension}`);
    await invoke('archive', source, destination);
    if (extension === 'zip') {
      const listing = (await exec('unzip', ['-Z', '-1', destination])).stdout.trimEnd().split('\n');
      assert.deepEqual(listing.sort(), archivePaths(matrix[0]).sort());
    } else await assertTarContents(destination, matrix[0]);
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
  it('archives only files selected by optional ancestor ignore scopes', async () => withParentFixture(async ({ base, source, parent, middle, target, invoke, invokeIn }) => {
    const check = async (destination, paths) => {
      const listing = (await exec('tar', ['-tf', destination])).stdout.trimEnd().split('\n');
      assert.deepEqual(listing.sort(), [...paths].sort());
    };
    const defaultDest = path.join(base, 'default.tar');
    await invoke('archive', target, defaultDest);
    await check(defaultDest, parentPaths.default);
    const selectedDest = path.join(base, 'selected.tar');
    await invoke('archive', target, selectedDest, '--parent', parent);
    await check(selectedDest, parentPaths.selected);
    const emptyDest = path.join(base, 'empty.tar');
    await invokeIn(parent, 'archive', target, emptyDest, '--parent', '');
    await check(emptyDest, parentPaths.selected);
    const rejected = path.join(base, 'rejected.tar');
    await assertCliError(invoke('archive', target, rejected, '--parent', source), /--parent must be an ancestor/);
    await assertCliError(invokeIn(middle, 'archive', target, rejected, '--parent', '..'), /Relative parent path requires --force/);
    await assert.rejects(lstat(rejected), { code: 'ENOENT' });
  }));
});
