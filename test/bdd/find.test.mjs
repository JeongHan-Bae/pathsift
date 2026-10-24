import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { matrix, withFixture, withParentFixture, withParentMatrixFixture, parentModes, parentModeSpellings, parentMatrixPaths, parentPaths, display, checkReadPathPolicy, assertCliError } from './support/fixture.mjs';

describe('find', () => {
  for (const variant of matrix) for (const mode of parentModes) it(`${variant.name} / ${mode.name} parent`, async () => withParentMatrixFixture(variant, async ({ base, source, invoke }) => {
    for (const spelling of parentModeSpellings(mode, base)) {
      const { stdout, stderr } = await invoke('find', source, ...variant.flags, ...spelling.flags);
      assert.equal(stderr, '', spelling.name);
      assert.equal(stdout, parentMatrixPaths(variant, mode).map(display).join('\n') + '\n', spelling.name);
    }
  }));
  it('treats .dockerignore as a Git-style filename with nested scopes', async () => withFixture(matrix[2], async ({ source, invoke }) => {
    await writeFile(path.join(source, '.dockerignore'), 'one-only.txt\n');
    await writeFile(path.join(source, 'sub', '.dockerignore'), 'nested-ignore.txt\n');
    const { stdout } = await invoke('find', source, '--ignore-file', '.dockerignore');
    assert.deepEqual(stdout.trimEnd().split('\n'), [
      '.deployignore', '.dockerignore', '.gitignore', 'always.txt', 'link-to-sub',
      'sub/', 'sub/.dockerignore', 'sub/.gitignore', 'sub/child.txt', 'two-only.txt'
    ]);
  }));
  it('requires force for parent-relative source', async () => withFixture(matrix[0], fixture => checkReadPathPolicy('find', fixture)));
  it('loads only selected ancestor scopes and accepts an empty parent as cwd', async () => withParentFixture(async ({ source, parent, middle, target, invoke, invokeIn }) => {
    const paths = async (...args) => (await invoke('find', target, ...args)).stdout.trimEnd().split('\n');
    assert.deepEqual(await paths(), parentPaths.default);
    assert.deepEqual(await paths('--parent', target), parentPaths.default);
    assert.deepEqual(await paths('--parent', parent), parentPaths.selected);
    assert.deepEqual((await invokeIn(parent, 'find', target, '--parent', '')).stdout.trimEnd().split('\n'), parentPaths.selected);
    assert.deepEqual((await invokeIn(parent, 'find', target, '--parent')).stdout.trimEnd().split('\n'), parentPaths.selected);
    assert.deepEqual((await invokeIn(parent, 'find', target, '--parent', '--')).stdout.trimEnd().split('\n'), parentPaths.selected);
    assert.deepEqual((await invokeIn(parent, 'find', target, '--parent', '--no-global-ignore')).stdout.trimEnd().split('\n'), parentPaths.noGlobal);
    assert.deepEqual(await paths('--parent', parent, '--ignore-file', '.gitignore', '--ignore-file', '.deployignore'), parentPaths.twoFiles);
    assert.deepEqual(await paths('--parent', parent, '--no-global-ignore'), parentPaths.noGlobal);
    assert.deepEqual(await paths('--parent', parent, '--no-ignore'), parentPaths.noIgnore);
    await assertCliError(invoke('find', target, '--parent', source), /--parent must be an ancestor/);
    await assertCliError(invokeIn(source, 'find', target, '--parent', ''), /--parent must be an ancestor/);
    await assertCliError(invokeIn(middle, 'find', target, '--parent', '..'), /Relative parent path requires --force/);
    assert.deepEqual((await invokeIn(middle, 'find', target, '--parent', '..', '--force')).stdout.trimEnd().split('\n'), parentPaths.selected);
  }));
});
