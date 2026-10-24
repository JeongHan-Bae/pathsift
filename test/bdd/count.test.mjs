import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matrix, withFixture, withParentFixture, withParentMatrixFixture, parentModes, parentModeSpellings, parentMatrixPaths, parentMatrixBytes, parentPaths, parentBytes, filePaths, checkReadPathPolicy, assertCliError } from './support/fixture.mjs';

describe('count', () => {
  for (const variant of matrix) for (const mode of parentModes) it(`${variant.name} / ${mode.name} parent`, async () => withParentMatrixFixture(variant, async ({ base, source, invoke }) => {
    const selected = { ...variant, paths: parentMatrixPaths(variant, mode) };
    for (const spelling of parentModeSpellings(mode, base)) {
      const { stdout, stderr } = await invoke('count', source, ...variant.flags, ...spelling.flags);
      assert.equal(stderr, '', spelling.name);
      assert.equal(stdout, `1 directories, ${filePaths(selected).length} files, ${parentMatrixBytes(variant, mode)} file bytes\n`, spelling.name);
    }
  }));
  it('requires force for parent-relative source', async () => withFixture(matrix[0], fixture => checkReadPathPolicy('count', fixture)));
  it('counts files using optional ancestor ignore scopes', async () => withParentFixture(async ({ source, parent, middle, target, invoke, invokeIn }) => {
    const expected = paths => `0 directories, ${paths.length} files, ${parentBytes(paths)} file bytes\n`;
    assert.equal((await invoke('count', target)).stdout, expected(parentPaths.default));
    assert.equal((await invoke('count', target, '--parent', parent)).stdout, expected(parentPaths.selected));
    assert.equal((await invokeIn(parent, 'count', target, '--parent', '')).stdout, expected(parentPaths.selected));
    await assertCliError(invoke('count', target, '--parent', source), /--parent must be an ancestor/);
    await assertCliError(invokeIn(middle, 'count', target, '--parent', '..'), /Relative parent path requires --force/);
  }));
});
