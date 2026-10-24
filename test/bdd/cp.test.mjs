import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { matrix, withFixture, filePaths, assertCopied, assertCliError } from './support/fixture.mjs';

const configWithLimit = bytes => JSON.stringify({ ignoreFiles: ['.gitignore'], globalIgnore: 'global.ignore', hashVersion: 1, bufferLimitBytes: bytes });

describe('cp', () => {
  for (const variant of matrix) it(variant.name, async () => withFixture(variant, async ({ base, source, invoke }) => {
    const destination = path.join(base, 'copy');
    const { stdout, stderr } = await invoke('cp', source, destination, ...variant.flags);
    assert.equal(stderr, '');
    assert.equal(stdout, `Copied ${filePaths(variant).length + 1} files/symlinks into ${destination}\n`);
    await assertCopied(source, destination, variant);
  }));
  it('copies c into a missing c/a without copying the output into itself', async () => withFixture(matrix[0], async ({ source, invoke }) => {
    const destination = path.join(source, 'a');
    await invoke('cp', source, destination);
    await assertCopied(source, destination, matrix[0]);
    assert.ok(!(await readdir(destination)).includes('a'));
  }));
  it('copies c into an existing empty c/a without nesting a/a', async () => withFixture(matrix[0], async ({ source, invoke }) => {
    const destination = path.join(source, 'a');
    await mkdir(destination);
    await invoke('cp', source, destination);
    await assertCopied(source, destination, matrix[0]);
    assert.ok(!(await readdir(destination)).includes('a'));
  }));
  it('refuses nonempty c/a before starting the source scan', async () => withFixture(matrix[0], async ({ source, invoke }) => {
    const destination = path.join(source, 'a');
    await mkdir(destination);
    await writeFile(path.join(destination, 'keep'), 'untouched');
    await assertCliError(invoke('cp', source, destination), /Destination is not empty/);
    assert.equal(await readFile(path.join(destination, 'keep'), 'utf8'), 'untouched');
  }));
  it('streams directly when visible regular files exceed the configured buffer limit', async () => withFixture(matrix[0], async ({ base, packageDir, source, invoke }) => {
    await writeFile(path.join(packageDir, 'pathsift.config.json'), configWithLimit(2));
    const destination = path.join(base, 'direct-copy');
    await invoke('cp', source, destination);
    await assertCopied(source, destination, matrix[0]);
  }));
  it('requires force for a parent-relative source or destination', async () => withFixture(matrix[0], async ({ base, source, invokeIn }) => {
    const cwd = path.join(base, 'child');
    await mkdir(cwd);
    await assertCliError(invokeIn(cwd, 'cp', '../source', './out'), /Relative parent path requires --force/);
    await assertCliError(invokeIn(cwd, 'cp', source, '../copy'), /Relative parent path requires --force/);
    const { stdout } = await invokeIn(cwd, 'cp', '../source', '../copy', '--force');
    assert.match(stdout, /^Copied \d+ files\/symlinks into /);
    await assertCopied(source, path.join(base, 'copy'), matrix[0]);
  }));
  it('refuses non-directory output and accepts a symlink-routed empty child', async () => withFixture(matrix[0], async ({ base, source, invoke }) => {
    const existing = path.join(base, 'existing');
    await writeFile(existing, 'untouched');
    await assertCliError(invoke('cp', source, existing, '--force'), /Destination must be an empty directory/);
    assert.equal(await readFile(existing, 'utf8'), 'untouched');
    const alias = path.join(base, 'alias');
    await symlink(source, alias, 'dir');
    await invoke('cp', source, path.join(alias, 'inside'));
    await assertCopied(source, path.join(source, 'inside'), matrix[0]);
    await assertCliError(invoke('cp', source), /requires source directory and destination/);
  }));
});
