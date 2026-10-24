import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { runNanoPty } from './support/nano-pty.mjs';
import { matrix, withFixture, assertCliError } from './support/fixture.mjs';


describe('nano', () => {
  it('refuses non-TTY input without writing', async () => withFixture(matrix[0], async ({ packageDir, invoke }) => {
    const file = path.join(packageDir, 'global.ignore');
    await assertCliError(invoke('nano'), /requires a TTY/);
    assert.equal(await readFile(file, 'utf8'), 'global-only.txt\n');
  }));
  it('saves edits through a TTY in an isolated package', async () => withFixture(matrix[0], async ({ packageDir, bin }) => {
    const result = await runNanoPty(process.execPath, bin, 'save');
    assert.equal(result.exit, 0);
    assert.match(result.transcript, /Saved:/);
    assert.equal(await readFile(path.join(packageDir, 'global.ignore'), 'utf8'), 'new.tmpglobal-only.txt\n');
  }));
  it('requires a second exit key to discard unsaved edits', async () => withFixture(matrix[0], async ({ packageDir, bin }) => {
    const result = await runNanoPty(process.execPath, bin, 'discard');
    assert.equal(result.exit, 0);
    assert.match(result.transcript, /Unsaved changes/);
    assert.equal(await readFile(path.join(packageDir, 'global.ignore'), 'utf8'), 'global-only.txt\n');
  }));
  it('refuses scan options without opening the editor', async () => withFixture(matrix[0], async ({ invoke }) => {
    await assertCliError(invoke('nano', '--force'), /nano does not accept --force/);
    await assertCliError(invoke('nano', '--parent', ''), /nano does not accept --parent/);
    await assertCliError(invoke('nano', '--parent'), /nano does not accept --parent/);
  }));
  it('refuses positional arguments', async () => withFixture(matrix[0], ({ invoke }) => assertCliError(invoke('nano', 'extra'), /nano takes no positional arguments/)));
});
