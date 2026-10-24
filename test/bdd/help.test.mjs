import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matrix, withFixture, assertCliError } from './support/fixture.mjs';
import { runCommandPty } from './support/nano-pty.mjs';

describe('help and command dispatch', () => {
  it('prints the same help for no command, help, and --help', async () => withFixture(matrix[0], async ({ invoke }) => {
    const outputs = await Promise.all([invoke(), invoke('help'), invoke('--help'), invoke('tree', '--parent', '', '--help'), invoke('tree', '--parent', '--help')]);
    for (const result of outputs) {
      assert.equal(result.stderr, '');
      assert.match(result.stdout, /Usage:/);
      assert.match(result.stdout, /--force/);
      assert.match(result.stdout, /--parent \[directory\]/);
      assert.match(result.stdout, /--parent \[directory\]\s+Start ignore collection at ancestor; bare or "" means cwd; omitted means source/);
      assert.match(result.stdout, /Selected ignore files are read along the parent-to-source path/);
      assert.match(result.stdout, /--parent combines with every --ignore-file selection and filtering switch/);
      assert.match(result.stdout, /Bare --parent also works before -- or another option/);
      assert.match(result.stdout, /--no-ignore skips ancestor rules; --no-global-ignore keeps them/);
      assert.match(result.stdout, /pathsift archive/);
    }
    assert.equal(outputs[0].stdout, outputs[1].stdout);
    assert.equal(outputs[1].stdout, outputs[2].stdout);
    assert.equal(outputs[2].stdout, outputs[3].stdout);
    assert.equal(outputs[3].stdout, outputs[4].stdout);
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
    await assertCliError(invoke('help', '--parent', ''), /help does not accept --parent/);
    await assertCliError(invoke('help', '--parent'), /help does not accept --parent/);
  }));
  it('reports unknown commands and malformed ignore options on stderr', async () => withFixture(matrix[0], async ({ source, invoke }) => {
    await assertCliError(invoke('unknown', source), /Unknown command/);
    await assertCliError(invoke('tree', source, '--ignore-file', '../bad'), /expects a filename/);
    await assertCliError(invoke('tree', source, '--bad-option'), /Unknown option/);
  }));
});
