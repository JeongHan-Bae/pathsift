import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matrix, withFixture, display, checkReadPathPolicy, assertCliError } from './support/fixture.mjs';

describe('ls', () => {
  for (const variant of matrix) it(variant.name, async () => withFixture(variant, async ({ source, invoke }) => {
    const { stdout, stderr } = await invoke('ls', source, ...variant.flags);
    assert.equal(stderr, '');
    assert.equal(stdout, variant.paths.filter(p => !p.includes('/')).map(display).join('\n') + '\n');
  }));
  it('requires force for parent-relative source and refuses an extra argument', async () => withFixture(matrix[0], async fixture => {
    await checkReadPathPolicy('ls', fixture);
    await assertCliError(fixture.invoke('ls', fixture.source, 'extra'), /Unexpected extra positional arguments/);
  }));
});
