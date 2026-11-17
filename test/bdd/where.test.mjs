import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { matrix, withFixture, withParentFixture, withParentMatrixFixture, parentModes, parentModeSpellings, parentMatrixPaths, kind, assertCliError } from './support/fixture.mjs';
import { runCommandPty } from './support/nano-pty.mjs';

const matchingPaths = (paths, query) => paths.filter(name => kind(name) === 'file' && name.slice(name.lastIndexOf('/') + 1) === query);

describe('where', () => {
  for (const variant of matrix) for (const mode of parentModes) it(`${variant.name} / ${mode.name} parent`, async () => withParentMatrixFixture(variant, async ({ base, source, invoke }) => {
    for (const spelling of parentModeSpellings(mode, base)) for (const query of ['always.txt', 'global-only.txt', 'one-only.txt', 'two-only.txt', 'child.txt', 'nested-ignore.txt']) {
      const result = await invoke('where', source, query, ...variant.flags, ...spelling.flags);
      assert.equal(result.stderr, '', spelling.name);
      const expected = matchingPaths(parentMatrixPaths(variant, mode), query);
      assert.equal(result.stdout, expected.length ? expected.join('\n') + '\n' : '', `${spelling.name} / ${query}`);
    }
  }));

  it('matches exact, contains and glob basenames in walker order', async () => withFixture(matrix[0], async ({ source, invoke }) => {
    await mkdir(path.join(source, 'src'));
    for (const name of ['config.ts', 'Config.ts', 'config.test.ts', 'api.txt']) await writeFile(path.join(source, 'src', name), '');
    for (const name of ['config.ts', 'config.json', 'apple.txt', '.hidden.txt', '-flag']) await writeFile(path.join(source, name), '');
    const run = (query, ...options) => invoke('where', source, query, ...options);
    for (const option of [[], ['--exact'], ['-e'], ['--exact', '-e']]) {
      const result = await run('config.ts', ...option);
      assert.equal(result.stdout, 'config.ts\nsrc/config.ts\n');
      assert.equal(result.stderr, '');
    }
    for (const option of ['--contains', '-c']) assert.equal((await run('config', option)).stdout, 'config.json\nconfig.ts\nsrc/config.test.ts\nsrc/config.ts\n');
    for (const option of ['--glob', '-g']) assert.equal((await run('a*.txt', option)).stdout, 'always.txt\napple.txt\nsrc/api.txt\n');
    assert.equal((await run('*.txt', '--glob')).stdout.includes('.hidden.txt\n'), true);
    assert.equal((await invoke('where', source, '--', '-flag')).stdout, '-flag\n');
    assert.equal((await run('nothing')).stdout, '');
  }));

  it('excludes ignored files, directories and symlinks without following links', async () => withFixture(matrix[1], async ({ source, invoke }) => {
    await mkdir(path.join(source, 'ignored'));
    await writeFile(path.join(source, '.gitignore'), 'ignored/\n');
    await writeFile(path.join(source, 'ignored', 'hit'), '');
    await writeFile(path.join(source, 'hit'), '');
    await mkdir(path.join(source, 'sub', 'hit'));
    await symlink('hit', path.join(source, 'sub', 'linked'), 'file');
    assert.equal((await invoke('where', source, 'hit')).stdout, 'hit\n');
    assert.equal((await invoke('where', source, 'hit', '--no-ignore')).stdout, 'hit\nignored/hit\n');
    assert.equal((await invoke('where', source, 'linked')).stdout, '');
    assert.equal((await invoke('where', source, 'nested-ignore.txt')).stdout, '');
  }));

  it('applies nested ignore and negation before contains and glob matching', async () => withFixture(matrix[1], async ({ source, invoke }) => {
    await mkdir(path.join(source, 'src'));
    await writeFile(path.join(source, '.gitignore'), 'build/\n');
    await mkdir(path.join(source, 'build'));
    await writeFile(path.join(source, 'build', 'config.ts'), '');
    await writeFile(path.join(source, 'src', '.gitignore'), 'config*.ts\n!config.ts\n');
    await writeFile(path.join(source, 'src', 'config.ts'), '');
    await writeFile(path.join(source, 'src', 'config.test.ts'), '');
    for (const flag of ['--contains', '-c']) assert.equal((await invoke('where', source, 'config', flag)).stdout, 'src/config.ts\n');
    for (const flag of ['--glob', '-g']) assert.equal((await invoke('where', source, 'config*.ts', flag)).stdout, 'src/config.ts\n');
    assert.equal((await invoke('where', source, 'config', '--contains', '--no-ignore')).stdout, 'build/config.ts\nsrc/config.test.ts\nsrc/config.ts\n');
    assert.equal((await invoke('where', source, 'config*.ts', '--glob', '--no-ignore')).stdout, 'build/config.ts\nsrc/config.test.ts\nsrc/config.ts\n');
  }));

  it('uses ancestor ignore rules and validates parent paths', async () => withParentFixture(async ({ source, parent, middle, target, invoke, invokeIn }) => {
    assert.equal((await invoke('where', target, 'outer.txt')).stdout, 'outer.txt\n');
    assert.equal((await invoke('where', target, 'outer.txt', '--parent', parent)).stdout, '');
    assert.equal((await invokeIn(parent, 'where', target, 'outer.txt', '--parent', '')).stdout, '');
    assert.equal((await invokeIn(parent, 'where', target, 'outer.txt', '--parent')).stdout, '');
    assert.equal((await invokeIn(parent, 'where', target, 'outer.txt', '--parent', '--')).stdout, '');
    assert.equal((await invokeIn(parent, 'where', target, 'outer.txt', '--parent', '--no-global-ignore')).stdout, '');
    await assertCliError(invoke('where', target, 'outer.txt', '--parent', source), /--parent must be an ancestor/);
    await assertCliError(invokeIn(middle, 'where', target, 'outer.txt', '--parent', '..'), /requires --force/);
    assert.equal((await invokeIn(middle, 'where', target, 'outer.txt', '--parent', '..', '--force')).stdout, '');
  }));

  it('reports invalid arguments and filesystem errors only on stderr', async () => withFixture(matrix[0], async ({ source, invoke }) => {
    for (const [args, pattern] of [
      [['where'], /nonempty filename query/], [['where', ''], /nonempty filename query/],
      [['where', source, 'config', 'extra'], /extra positional/],
      [['where', 'config', '--exact', '--contains'], /mutually exclusive/],
      [['where', 'config', '--bad'], /Unknown option/],
      [['where', 'src/config'], /directory separators/],
      [['where', 'src\\config'], /directory separators/],
      [['where', '[bad', '--glob'], /Invalid glob/],
      [['where', path.join(source, 'missing'), 'config'], /ENOENT/],
      [['where', path.join(source, 'always.txt'), 'config'], /directory|ENOTDIR/i]
    ]) await assertCliError(invoke(...args), pattern);
    const child = path.join(source, 'sub');
    await assertCliError(invoke('where', '../source', 'child.txt'), /requires --force/);
    assert.equal((await invoke('where', child, 'child.txt')).stdout, 'child.txt\n');
    assert.equal((await invoke('where', child, 'child.txt', '--help')).stdout.includes('Modes are exclusive and case-sensitive'), true);
  }));
  it('uses directory then query positions and preserves the option terminator', async () => withFixture(matrix[0], async ({ base, source, invoke, invokeIn }) => {
    for (const name of ['--literal', '--config', '--contains', '--glob', '--exact']) await writeFile(path.join(source, name), '');
    assert.equal((await invokeIn(source, 'where', '--', '--literal')).stdout, '--literal\n');
    assert.equal((await invoke('where', source, '--', '--contains')).stdout, '--contains\n');
    assert.equal((await invoke('where', source, '--', '--glob')).stdout, '--glob\n');
    assert.equal((await invoke('where', source, '--parent', '--', '--config')).stdout, '--config\n');
    assert.equal((await invoke('where', source, '--exact', '--', '--literal')).stdout, '--literal\n');
    assert.equal((await invoke('where', source, '--', '--exact')).stdout, '--exact\n');
    assert.equal((await invoke('where', source, '--parent=' + base, '--', '--config')).stdout, '--config\n');
    await assertCliError(invoke('where', '--', '../config.ts'), /directory separators/);
    await assertCliError(invoke('where', '--', '../source', 'config.ts'), /requires --force/);
    await assertCliError(invoke('where', 'config.ts', 'source'), /ENOENT/);
    await assertCliError(invoke('where', source, '--', '--literal', '--exact'), /extra positional/);
    assert.equal((await invoke('where', '--help')).stdout.includes('Usage:'), true);
    assert.equal((await invoke('where', source, '--', '--help')).stdout, '');
  }));
  it('does not emphasize the first match on a TTY', async () => withFixture(matrix[0], async ({ bin, source }) => {
    await writeFile(path.join(source, 'AGENTS.md'), '');
    await writeFile(path.join(source, 'sub', 'AGENTS.md'), '');
    const tty = await runCommandPty(process.execPath, bin, ['where', source, 'AGENTS.md']);
    assert.equal(tty.exit, 0);
    assert.match(tty.transcript, /AGENTS\.md[\s\S]*sub\/AGENTS\.md/);
    assert.doesNotMatch(tty.transcript, /\x1b\[36mAGENTS\.md/);
  }));
});
