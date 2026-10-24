import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matrix, withFixture, fileBytes, filePaths, checkReadPathPolicy } from './support/fixture.mjs';

describe('count', () => {
  for (const variant of matrix) it(variant.name, async () => withFixture(variant, async ({ source, invoke }) => {
    const { stdout, stderr } = await invoke('count', source, ...variant.flags);
    assert.equal(stderr, '');
    assert.equal(stdout, `1 directories, ${filePaths(variant).length} files, ${fileBytes(variant)} file bytes\n`);
  }));
  it('requires force for parent-relative source', async () => withFixture(matrix[0], fixture => checkReadPathPolicy('count', fixture)));
});
