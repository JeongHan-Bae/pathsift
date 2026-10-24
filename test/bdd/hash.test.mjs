import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { matrix, withFixture, withParentFixture, withParentMatrixFixture, parentModes, parentModeSpellings, parentMatrixPaths, parentPaths, parentContents, filePaths, hashOf, checkReadPathPolicy, assertCliError } from './support/fixture.mjs';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const fileHash = (filename, contentHash) => sha256(`pathsift-file-v1:${sha256(filename)}${contentHash}`);
const expectedTreeHash = variant => {
  const paths = filePaths(variant).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
  return sha256(`pathsift-tree-v1:${paths.length}:${paths.map(p => fileHash(p, hashOf(p))).join('')}`);
};

function treeDigest(output, source) {
  const line = output.trimEnd().split('\n').at(-1);
  const match = /^tree-sha256  ([a-f0-9]{64})  (.+)$/.exec(line);
  assert.ok(match, `missing tree digest: ${line}`);
  assert.equal(match[2], source);
  return match[1];
}

describe('hash', () => {
  for (const variant of matrix) for (const mode of parentModes) it(`${variant.name} / ${mode.name} parent`, async () => withParentMatrixFixture(variant, async ({ base, source, invoke }) => {
    const selected = { ...variant, paths: parentMatrixPaths(variant, mode) };
    for (const spelling of parentModeSpellings(mode, base)) {
      const { stdout, stderr } = await invoke('hash', source, ...variant.flags, ...spelling.flags);
      assert.equal(stderr, '', spelling.name);
      assert.deepEqual(stdout.trimEnd().split('\n').slice(0, -1), filePaths(selected).map(p => `file-sha256  ${fileHash(p, hashOf(p))}  ${p}`), spelling.name);
      assert.equal(treeDigest(stdout, source), expectedTreeHash(selected), spelling.name);
    }
  }));
  it('changes the tree digest when a visible file is renamed without changing its bytes', async () => withFixture(matrix[0], async ({ source, invoke }) => {
    const before = (await invoke('hash', source)).stdout;
    const contentDigest = hashOf('always.txt');
    await rename(path.join(source, 'always.txt'), path.join(source, 'renamed.txt'));
    const after = (await invoke('hash', source)).stdout;
    assert.ok(before.includes(`file-sha256  ${fileHash('always.txt', contentDigest)}  always.txt`));
    assert.ok(after.includes(`file-sha256  ${fileHash('renamed.txt', contentDigest)}  renamed.txt`));
    assert.notEqual(fileHash('always.txt', contentDigest), fileHash('renamed.txt', contentDigest));
    assert.notEqual(treeDigest(after, source), treeDigest(before, source));
  }));
  it('changes the tree digest when bytes move across a file boundary', async () => withFixture(matrix[0], async ({ source, invoke }) => {
    const a = path.join(source, 'always.txt');
    const b = path.join(source, 'one-only.txt');
    const beforeBytes = (await readFile(a, 'utf8')) + (await readFile(b, 'utf8'));
    const before = (await invoke('hash', source)).stdout;
    await writeFile(a, 'ab');
    await writeFile(b, 'cone');
    assert.equal((await readFile(a, 'utf8')) + (await readFile(b, 'utf8')), beforeBytes);
    const after = (await invoke('hash', source)).stdout;
    assert.ok(after.includes(`file-sha256  ${fileHash('always.txt', sha256('ab'))}  always.txt`));
    assert.ok(after.includes(`file-sha256  ${fileHash('one-only.txt', sha256('cone'))}  one-only.txt`));
    assert.notEqual(treeDigest(after, source), treeDigest(before, source));
  }));
  it('changes the tree digest when the later file moves entirely into the first file', async () => withFixture(matrix[0], async ({ source, invoke }) => {
    const first = path.join(source, 'always.txt');
    const later = path.join(source, 'one-only.txt');
    const before = (await invoke('hash', source)).stdout;
    const laterBytes = await readFile(later, 'utf8');
    await writeFile(first, laterBytes + await readFile(first, 'utf8'));
    await writeFile(later, '');
    const after = (await invoke('hash', source)).stdout;
    assert.notEqual(treeDigest(after, source), treeDigest(before, source));
    assert.ok(after.includes(`file-sha256  ${fileHash('one-only.txt', sha256(''))}  one-only.txt`));
  }));
  it('changes the tree digest when a file moves out of a folder but stays first in sorted order', async () => withFixture(matrix[0], async ({ source, invoke }) => {
    await mkdir(path.join(source, '0'));
    await writeFile(path.join(source, '0', 'first.txt'), 'fixed');
    const before = (await invoke('hash', source)).stdout;
    assert.match(before.split('\n')[0], /  0\/first\.txt$/);
    await rename(path.join(source, '0', 'first.txt'), path.join(source, '0-first.txt'));
    const after = (await invoke('hash', source)).stdout;
    assert.match(after.split('\n')[0], /  0-first\.txt$/);
    assert.notEqual(treeDigest(after, source), treeDigest(before, source));
  }));
  it('distinguishes a, dir_1(b,c,d) from a, b, dir_1(c,d)', async () => withFixture(matrix[0], async ({ source, invoke }) => {
    await rm(source, { recursive: true, force: true });
    const folder = path.join(source, 'dir_1');
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(source, 'a'), 'A');
    for (const name of ['b', 'c', 'd']) await writeFile(path.join(folder, name), name.toUpperCase());
    const before = (await invoke('hash', source, '--no-global-ignore')).stdout;
    const oldB = before.match(/file-sha256  ([a-f0-9]{64})  dir_1\/b/)[1];
    await rename(path.join(folder, 'b'), path.join(source, 'b'));
    const after = (await invoke('hash', source, '--no-global-ignore')).stdout;
    const newB = after.match(/file-sha256  ([a-f0-9]{64})  b(?:\n|$)/)[1];
    assert.notEqual(newB, oldB);
    assert.notEqual(treeDigest(after, source), treeDigest(before, source));
  }));
  it('distinguishes equal content in differently named files', async () => withFixture(matrix[0], async ({ source, invoke }) => {
    await writeFile(path.join(source, 'duplicate.txt'), 'abc');
    const output = (await invoke('hash', source)).stdout;
    const first = output.match(/file-sha256  ([a-f0-9]{64})  always\.txt/)[1];
    const duplicate = output.match(/file-sha256  ([a-f0-9]{64})  duplicate\.txt/)[1];
    assert.notEqual(first, duplicate);
  }));
  it('keeps the same tree digest when the whole scan root moves from a to b', async () => withFixture(matrix[2], async ({ base, source, invoke }) => {
    const before = (await invoke('hash', source, ...matrix[2].flags)).stdout;
    const moved = path.join(base, 'b');
    await rename(source, moved);
    const after = (await invoke('hash', moved, ...matrix[2].flags)).stdout;
    assert.equal(treeDigest(after, moved), treeDigest(before, source));
    assert.deepEqual(after.trimEnd().split('\n').slice(0, -1), before.trimEnd().split('\n').slice(0, -1));
  }));
  it('uses the directory argument as the relative-path base, not the CLI location', async () => withFixture(matrix[0], async ({ source, invoke, invokeIn }) => {
    await rm(source, { recursive: true, force: true });
    const nested = path.join(source, 'sub');
    await mkdir(nested, { recursive: true });
    await writeFile(path.join(nested, 'file.txt'), 'fixed');
    const outer = (await invoke('hash', source, '--no-global-ignore')).stdout;
    const inner = (await invoke('hash', nested, '--no-global-ignore')).stdout;
    assert.match(outer, /  sub\/file\.txt\n/);
    assert.match(inner, /  file\.txt\n/);
    assert.notEqual(treeDigest(outer, source), treeDigest(inner, nested));
    const fromParent = (await invokeIn(source, 'hash', 'sub', '--no-global-ignore')).stdout;
    const fromNested = (await invokeIn(nested, 'hash', './', '--no-global-ignore')).stdout;
    assert.equal(fromNested, fromParent);
    assert.deepEqual(fromNested.trimEnd().split('\n').slice(0, -1), inner.trimEnd().split('\n').slice(0, -1));
  }));
  it('ignores content changes in excluded files', async () => withFixture(matrix[1], async ({ source, invoke }) => {
    const before = treeDigest((await invoke('hash', source)).stdout, source);
    await writeFile(path.join(source, 'one-only.txt'), 'changed while ignored');
    assert.equal(treeDigest((await invoke('hash', source)).stdout, source), before);
  }));
  it('requires force for parent-relative source', async () => withFixture(matrix[0], fixture => checkReadPathPolicy('hash', fixture)));
  it('hashes the target-relative selected files under ancestor ignore scopes', async () => withParentFixture(async ({ source, parent, middle, target, invoke, invokeIn }) => {
    const expected = paths => {
      const hashes = paths.map(name => fileHash(name, sha256(parentContents[name])));
      return [...paths.map((name, index) => `file-sha256  ${hashes[index]}  ${name}`), `tree-sha256  ${sha256(`pathsift-tree-v1:${paths.length}:${hashes.join('')}`)}  ${target}`, ''].join('\n');
    };
    assert.equal((await invoke('hash', target)).stdout, expected(parentPaths.default));
    assert.equal((await invoke('hash', target, '--parent', parent)).stdout, expected(parentPaths.selected));
    assert.equal((await invokeIn(parent, 'hash', target, '--parent', '')).stdout, expected(parentPaths.selected));
    await assertCliError(invoke('hash', target, '--parent', source), /--parent must be an ancestor/);
    await assertCliError(invokeIn(middle, 'hash', target, '--parent', '..'), /Relative parent path requires --force/);
  }));
});
