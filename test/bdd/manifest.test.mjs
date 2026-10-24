import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lstat } from 'node:fs/promises';
import path from 'node:path';
import { matrix, withFixture, withParentFixture, withParentMatrixFixture, parentModes, parentModeSpellings, parentMatrixPaths, parentPaths, parentBytes, kind, checkReadPathPolicy, assertCliError } from './support/fixture.mjs';
import { runCommandPty } from './support/nano-pty.mjs';

describe('manifest', () => {
  for (const variant of matrix) for (const mode of parentModes) it(`${variant.name} / ${mode.name} parent`, async () => withParentMatrixFixture(variant, async ({ base, source, invoke }) => {
    const expected = [];
    for (const p of parentMatrixPaths(variant, mode)) expected.push({ path: p, kind: kind(p), size: (await lstat(path.join(source, p))).size });
    for (const spelling of parentModeSpellings(mode, base)) {
      const { stdout, stderr } = await invoke('manifest', source, ...variant.flags, ...spelling.flags);
      assert.equal(stderr, '', spelling.name);
      assert.deepEqual(JSON.parse(stdout), { root: source, entries: expected }, spelling.name);
      assert.ok(stdout.endsWith('\n'), spelling.name);
    }
  }));
  it('keeps JSON parseable and unstyled on a TTY', async () => withFixture(matrix[2], async ({ bin, source }) => {
    const tty = await runCommandPty(process.execPath, bin, ['manifest', source, ...matrix[2].flags]);
    assert.equal(tty.exit, 0);
    assert.ok(!tty.transcript.includes('\x1b['));
    assert.deepEqual(JSON.parse(tty.transcript).entries.map(entry => entry.path), matrix[2].paths);
  }));
  it('requires force for parent-relative source', async () => withFixture(matrix[0], fixture => checkReadPathPolicy('manifest', fixture)));
  it('writes JSON using optional ancestor ignore scopes', async () => withParentFixture(async ({ source, parent, middle, target, invoke, invokeIn }) => {
    const expected = paths => ({ root: target, entries: paths.map(name => ({ path: name, kind: 'file', size: parentBytes([name]) })) });
    assert.deepEqual(JSON.parse((await invoke('manifest', target)).stdout), expected(parentPaths.default));
    assert.deepEqual(JSON.parse((await invoke('manifest', target, '--parent', parent)).stdout), expected(parentPaths.selected));
    assert.deepEqual(JSON.parse((await invokeIn(parent, 'manifest', target, '--parent', '')).stdout), expected(parentPaths.selected));
    await assertCliError(invoke('manifest', target, '--parent', source), /--parent must be an ancestor/);
    await assertCliError(invokeIn(middle, 'manifest', target, '--parent', '..'), /Relative parent path requires --force/);
  }));
});
