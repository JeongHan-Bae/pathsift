import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lstat } from 'node:fs/promises';
import path from 'node:path';
import { matrix, withFixture, kind, checkReadPathPolicy } from './support/fixture.mjs';
import { runCommandPty } from './support/nano-pty.mjs';

describe('manifest', () => {
  for (const variant of matrix) it(variant.name, async () => withFixture(variant, async ({ source, invoke }) => {
    const { stdout, stderr } = await invoke('manifest', source, ...variant.flags);
    assert.equal(stderr, '');
    const expected = [];
    for (const p of variant.paths) expected.push({ path: p, kind: kind(p), size: (await lstat(path.join(source, p))).size });
    assert.deepEqual(JSON.parse(stdout), { root: source, entries: expected });
    assert.ok(stdout.endsWith('\n'));
  }));
  it('keeps JSON parseable and unstyled on a TTY', async () => withFixture(matrix[2], async ({ bin, source }) => {
    const tty = await runCommandPty(process.execPath, bin, ['manifest', source, ...matrix[2].flags]);
    assert.equal(tty.exit, 0);
    assert.ok(!tty.transcript.includes('\x1b['));
    assert.deepEqual(JSON.parse(tty.transcript).entries.map(entry => entry.path), matrix[2].paths);
  }));
  it('requires force for parent-relative source', async () => withFixture(matrix[0], fixture => checkReadPathPolicy('manifest', fixture)));
});
