import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, open, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { matrix, withFixture, assertCliError } from './support/fixture.mjs';
import { runCommandPty } from './support/nano-pty.mjs';

describe('help and command dispatch', () => {
  it('prints the same global help for no command, help, --help, and -h', async () => withFixture(matrix[0], async ({ invoke }) => {
    const outputs = await Promise.all([invoke(), invoke('help'), invoke('--help'), invoke('-h')]);
    for (const result of outputs) {
      assert.equal(result.stderr, '');
      assert.match(result.stdout, /Usage:/);
      assert.match(result.stdout, /--force/);
      assert.match(result.stdout, /--parent \[directory]/);
      assert.match(result.stdout, /`--parent \[directory]`\s+Start ignore collection at ancestor; bare or "" means cwd; omitted means source/);
      assert.match(result.stdout, /ancestor scopes apply/);
      assert.match(result.stdout, /`--parent` combines with `--ignore-file` and filtering switches/);
      assert.match(result.stdout, /bare `--parent` uses cwd, including before `--`/);
      assert.match(result.stdout, /`--no-ignore`\s+Disable all filtering/);
      assert.match(result.stdout, /`--no-global-ignore`\s+Disable global.ignore; keep directory rules/);
      assert.match(result.stdout, /pathsift archive/);
    }
    assert.equal(outputs[0].stdout, outputs[1].stdout);
    assert.equal(outputs[1].stdout, outputs[2].stdout);
    assert.equal(outputs[2].stdout, outputs[3].stdout);
    const usage = outputs[0].stdout.split('Usage:\n')[1].split('\n\nDirectory-command options:')[0];
    assert.deepEqual([...usage.matchAll(/^ {2}`pathsift (\w+)/gm)].map(match => match[1]), [
      'tree', 'ls', 'find', 'where', 'count', 'du', 'hash', 'manifest', 'cp', 'archive', 'nano', 'config', 'help'
    ]);
    assert.match(outputs[0].stdout, /Sum visible regular-file bytes \(not Unix du\)/);
    assert.match(outputs[0].stdout, /pathsift where \[directory] <query> \[options]/);
    assert.doesNotMatch(outputs[0].stdout, /--modified-before <YYYY-MM-DD>|Where matching:/);
    assert.match(outputs[0].stdout, /Use `pathsift <command> --help` for command details/);
    assert.match(outputs[0].stdout, /Git-style rules, including \.dockerignore/);
    assert.match(outputs[0].stdout, /missing or empty directory/);
    assert.match(outputs[0].stdout, /exports skip their own empty output path/);
    const treeHelp = await invoke('tree', '--parent', '', '--help');
    assert.equal(treeHelp.stdout, (await invoke('tree', '--parent', '--help')).stdout);
    assert.notEqual(treeHelp.stdout, outputs[0].stdout);
  }));
  it('describes find filters and where matching in command help', async () => withFixture(matrix[0], async ({ invoke }) => {
    const find = await invoke('find', '--help');
    assert.equal(find.stderr, '');
    assert.match(find.stdout, /Find filters:/);
    assert.match(find.stdout, /--max-depth/);
    assert.match(find.stdout, /text, binary/);
    assert.match(find.stdout, /AND/);
    assert.match(find.stdout, /Project filters use AND; not POSIX find-compatible/);
    assert.match(find.stdout, /`--name` matches the basename/);
    const where = await invoke('where', '--help');
    assert.equal(where.stderr, '');
    assert.match(where.stdout, /\[directory] <query>/);
    assert.match(where.stdout, /-g, --glob/);
    assert.match(where.stdout, /directory then query/);
  }));
  it('shows concise help for every command without requiring scan inputs or a TTY', async () => withFixture(matrix[0], async ({ source, invoke }) => {
    const names = ['tree', 'ls', 'find', 'where', 'count', 'du', 'hash', 'manifest', 'cp', 'archive', 'nano', 'config'];
    for (const name of names) {
      const long = await invoke(name, '--help');
      const short = await invoke(name, '-h');
      assert.equal(long.stderr, '', name);
      assert.equal(long.stdout, short.stdout, name);
      assert.match(long.stdout, new RegExp(`pathsift ${name}`), name);
      assert.match(long.stdout, /Usage:/, name);
      assert.match(long.stdout, /Examples:/, name);
      assert.equal([...long.stdout.matchAll(/^ {2}`pathsift (\w+)/gm)].filter(match => match[1] === name).length >= 1, true, name);
      if (name === 'nano' || name === 'config') assert.doesNotMatch(long.stdout, /--ignore-file|--parent/, name);
      else assert.match(long.stdout, /--ignore-file/, name);
    }
    for (const name of ['tree', 'find', 'where', 'cp', 'archive']) {
      const result = await invoke(name, source, 'missing', '--help');
      assert.equal(result.stderr, '', name);
      assert.match(result.stdout, new RegExp(`pathsift ${name}`), name);
    }
    assert.equal((await invoke('find', '--parent', '--help')).stderr, '');
    assert.equal((await invoke('where', '--parent', '-h')).stderr, '');
  }));
  it('keeps help-looking strings literal after --, including after bare --parent', async () => withFixture(matrix[0], async ({ base, source, invoke, invokeIn }) => {
    await writeFile(path.join(source, '--help'), '');
    await writeFile(path.join(source, '-h'), '');
    assert.equal((await invokeIn(source, 'where', '--', '--help')).stdout, '--help\n');
    assert.equal((await invoke('where', source, '--', '-h')).stdout, '-h\n');
    assert.equal((await invoke('where', source, '--parent', '--', '-h')).stdout, '-h\n');
    const literalDirectory = path.join(base, '--help');
    await mkdir(literalDirectory);
    await writeFile(path.join(literalDirectory, 'item.txt'), '');
    assert.equal((await invokeIn(base, 'find', '--', '--help')).stdout, 'item.txt\n');
    assert.match((await invoke('find', '--help', '--')).stdout, /pathsift find/);
  }));
  it('uses Ink styling only for an interactive terminal', async () => withFixture(matrix[0], async ({ bin, invoke }) => {
    const piped = await invoke('--help');
    assert.ok(!piped.stdout.includes('\x1b['));
    assert.match(piped.stdout, /^ {2}`pathsift tree \[directory]`\s+Draw directories/m);
    assert.doesNotMatch(piped.stdout, /`Draw directories/);
    const tty = await runCommandPty(process.execPath, bin, ['--help']);
    assert.equal(tty.exit, 0);
    assert.match(tty.transcript, /Usage:/);
    assert.match(tty.transcript, /\x1b\[/);
    assert.match(tty.transcript, /\x1b\[35mpathsift tree \[directory]\x1b\[39m\r?\n {4}Draw/);
    const commandPipe = await invoke('find', '--help');
    assert.ok(!commandPipe.stdout.includes('\x1b['));
    assert.match(commandPipe.stdout, /`--type <type>`\s+file, dir/);
    assert.match(commandPipe.stdout, /`--name` matches the basename/);
    const commandTty = await runCommandPty(process.execPath, bin, ['find', '--help']);
    assert.equal(commandTty.exit, 0);
    assert.match(commandTty.transcript, /Find filters:/);
    assert.match(commandTty.transcript, /\x1b\[/);
    assert.match(commandTty.transcript, /\x1b\[35m--type <type>\x1b\[39m\r?\n {4}file, dir/);
  }));
  it('writes backtick-marked help without ANSI when stdout is redirected to a file', async () => withFixture(matrix[0], async ({ base, bin }) => {
    const output = path.join(base, 'out.txt');
    const handle = await open(output, 'w');
    try {
      const child = spawn(process.execPath, [bin, '-h'], { cwd: base, stdio: ['ignore', handle.fd, 'pipe'] });
      /** @type {Buffer[]} */
      const stderr = [];
      child.stderr.on('data', chunk => stderr.push(chunk));
      const [status] = await once(child, 'close');
      assert.equal(status, 0);
      assert.equal(Buffer.concat(stderr).toString(), '');
    } finally { await handle.close(); }
    const text = (await readFile(output)).toString('utf8');
    assert.match(text, /`pathsift tree \[directory]`\s+Draw directories/);
    assert.doesNotMatch(text, /\x1b\[|`Draw directories/);
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
