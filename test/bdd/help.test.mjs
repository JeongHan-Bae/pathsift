import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matrix, withFixture, assertCliError } from './support/fixture.mjs';
import { runCommandPty } from './support/nano-pty.mjs';

describe('help and command dispatch', () => {
  it('prints the same help for no command, help, and --help', async () => withFixture(matrix[0], async ({ invoke }) => {
    const outputs = await Promise.all([invoke(), invoke('help'), invoke('--help')]);
    for (const result of outputs) {
      assert.equal(result.stderr, '');
      assert.match(result.stdout, /Usage:/);
      assert.match(result.stdout, /--force/);
      assert.match(result.stdout, /pathsift archive/);
    }
    assert.equal(outputs[0].stdout, outputs[1].stdout);
    assert.equal(outputs[1].stdout, outputs[2].stdout);
    const usage = outputs[0].stdout.split('Usage:\n')[1].split('\n\nDirectory-command options:')[0];
    assert.deepEqual([...usage.matchAll(/^  pathsift (\w+)/gm)].map(match => match[1]), [
      'tree', 'ls', 'find', 'count', 'du', 'hash', 'manifest', 'cp', 'archive', 'nano', 'config', 'help'
    ]);
    assert.match(outputs[0].stdout, /Sum visible regular-file bytes \(not Unix du\)/);
    assert.match(outputs[0].stdout, /Git-style rules, including \.dockerignore/);
    assert.match(outputs[0].stdout, /missing or empty directory/);
    assert.match(outputs[0].stdout, /exports skip their own empty output path/);
  }));
  it('uses Ink styling only for an interactive terminal', async () => withFixture(matrix[0], async ({ bin, invoke }) => {
    const piped = await invoke('--help');
    assert.ok(!piped.stdout.includes('\x1b['));
    const tty = await runCommandPty(process.execPath, bin, ['--help']);
    assert.equal(tty.exit, 0);
    assert.match(tty.transcript, /Usage:/);
    assert.match(tty.transcript, /\x1b\[/);
  }));
  it('refuses extra help arguments and scan options', async () => withFixture(matrix[0], async ({ invoke }) => {
    await assertCliError(invoke('help', 'extra'), /help takes no positional arguments/);
    await assertCliError(invoke('help', '--force'), /help does not accept --force/);
  }));
  it('reports unknown commands and malformed ignore options on stderr', async () => withFixture(matrix[0], async ({ source, invoke }) => {
    await assertCliError(invoke('unknown', source), /Unknown command/);
    await assertCliError(invoke('tree', source, '--ignore-file', '../bad'), /expects a filename/);
    await assertCliError(invoke('tree', source, '--bad-option'), /Unknown option/);
  }));
});
