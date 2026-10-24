import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matrix, withFixture, withParentFixture, withParentMatrixFixture, parentModes, parentModeSpellings, parentMatrixBytes, parentPaths, parentBytes, checkReadPathPolicy, assertCliError } from './support/fixture.mjs';

describe('du', () => {
  for (const variant of matrix) for (const mode of parentModes) it(`${variant.name} / ${mode.name} parent`, async () => withParentMatrixFixture(variant, async ({ base, source, invoke }) => {
    for (const spelling of parentModeSpellings(mode, base)) {
      const { stdout, stderr } = await invoke('du', source, ...variant.flags, ...spelling.flags);
      assert.equal(stderr, '', spelling.name);
      assert.equal(stdout, `${parentMatrixBytes(variant, mode)}\t${source}\n`, spelling.name);
    }
  }));
  it('requires force for parent-relative source', async () => withFixture(matrix[0], fixture => checkReadPathPolicy('du', fixture)));
  it('sums files using optional ancestor ignore scopes', async () => withParentFixture(async ({ source, parent, middle, target, invoke, invokeIn }) => {
    const expected = paths => `${parentBytes(paths)}\t${target}\n`;
    assert.equal((await invoke('du', target)).stdout, expected(parentPaths.default));
    assert.equal((await invoke('du', target, '--parent', parent)).stdout, expected(parentPaths.selected));
    assert.equal((await invokeIn(parent, 'du', target, '--parent', '')).stdout, expected(parentPaths.selected));
    await assertCliError(invoke('du', target, '--parent', source), /--parent must be an ancestor/);
    await assertCliError(invokeIn(middle, 'du', target, '--parent', '..'), /Relative parent path requires --force/);
  }));
});
