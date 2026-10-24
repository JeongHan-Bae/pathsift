import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matrix, withFixture, withParentFixture, withParentMatrixFixture, parentModes, parentModeSpellings, parentMatrixPaths, parentPaths, display, checkReadPathPolicy, assertCliError } from './support/fixture.mjs';

describe('ls', () => {
  for (const variant of matrix) for (const mode of parentModes) it(`${variant.name} / ${mode.name} parent`, async () => withParentMatrixFixture(variant, async ({ base, source, invoke }) => {
    for (const spelling of parentModeSpellings(mode, base)) {
      const { stdout, stderr } = await invoke('ls', source, ...variant.flags, ...spelling.flags);
      assert.equal(stderr, '', spelling.name);
      assert.equal(stdout, parentMatrixPaths(variant, mode).filter(p => !p.includes('/')).map(display).join('\n') + '\n', spelling.name);
    }
  }));
  it('requires force for parent-relative source and refuses an extra argument', async () => withFixture(matrix[0], async fixture => {
    await checkReadPathPolicy('ls', fixture);
    await assertCliError(fixture.invoke('ls', fixture.source, 'extra'), /Unexpected extra positional arguments/);
  }));
  it('lists the target with optional ancestor ignore scopes', async () => withParentFixture(async ({ source, parent, middle, target, invoke, invokeIn }) => {
    assert.equal((await invoke('ls', target)).stdout, parentPaths.default.join('\n') + '\n');
    assert.equal((await invoke('ls', target, '--parent', parent)).stdout, parentPaths.selected.join('\n') + '\n');
    assert.equal((await invokeIn(parent, 'ls', target, '--parent', '')).stdout, parentPaths.selected.join('\n') + '\n');
    await assertCliError(invoke('ls', target, '--parent', source), /--parent must be an ancestor/);
    await assertCliError(invokeIn(middle, 'ls', target, '--parent', '..'), /Relative parent path requires --force/);
  }));
});
