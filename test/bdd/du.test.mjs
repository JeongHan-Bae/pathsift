import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matrix, withFixture, fileBytes, checkReadPathPolicy } from './support/fixture.mjs';

describe('du', () => {
  for (const variant of matrix) it(variant.name, async () => withFixture(variant, async ({ source, invoke }) => {
    const { stdout, stderr } = await invoke('du', source, ...variant.flags);
    assert.equal(stderr, '');
    assert.equal(stdout, `${fileBytes(variant)}\t${source}\n`);
  }));
  it('requires force for parent-relative source', async () => withFixture(matrix[0], fixture => checkReadPathPolicy('du', fixture)));
});
