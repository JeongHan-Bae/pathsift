import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { matrix, withFixture, display, checkReadPathPolicy } from './support/fixture.mjs';

describe('find', () => {
  for (const variant of matrix) it(variant.name, async () => withFixture(variant, async ({ source, invoke }) => {
    const { stdout, stderr } = await invoke('find', source, ...variant.flags);
    assert.equal(stderr, '');
    assert.equal(stdout, variant.paths.map(display).join('\n') + '\n');
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
});
