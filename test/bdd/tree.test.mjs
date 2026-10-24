import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { matrix, withFixture, withParentFixture, withParentMatrixFixture, parentModes, parentModeSpellings, parentMatrixPaths, parentMatrixBytes, parentPaths, parentBytes, filePaths, checkReadPathPolicy, assertCliError } from './support/fixture.mjs';
import { runCommandPty } from './support/nano-pty.mjs';

const expectedBranches = [
  ['├── sub/', '│   ├── child.txt', '│   └── nested-ignore.txt', '├── always.txt', '├── link-to-sub@', '├── one-only.txt', '└── two-only.txt'],
  ['├── sub/', '│   ├── .gitignore', '│   └── child.txt', '├── .gitignore', '├── always.txt', '├── link-to-sub@', '└── two-only.txt'],
  ['├── sub/', '│   ├── .gitignore', '│   └── child.txt', '├── .deployignore', '├── .gitignore', '├── always.txt', '└── link-to-sub@'],
  ['├── sub/', '│   ├── .gitignore', '│   └── child.txt', '├── .deployignore', '├── .gitignore', '├── always.txt', '├── global-only.txt', '└── link-to-sub@'],
  ['├── sub/', '│   ├── .gitignore', '│   ├── child.txt', '│   └── nested-ignore.txt', '├── .deployignore', '├── .gitignore', '├── always.txt', '├── global-only.txt', '├── link-to-sub@', '├── one-only.txt', '└── two-only.txt']
];

const ancestorBranches = [
  expectedBranches[0],
  ['├── sub/', '│   ├── .gitignore', '│   └── child.txt', '├── .gitignore', '├── link-to-sub@', '└── two-only.txt'],
  ['├── sub/', '│   └── .gitignore', '├── .deployignore', '├── .gitignore', '└── link-to-sub@'],
  ['├── sub/', '│   └── .gitignore', '├── .deployignore', '├── .gitignore', '├── global-only.txt', '└── link-to-sub@'],
  expectedBranches[4]
];

describe('tree', () => {
  matrix.forEach((variant, index) => {
    for (const mode of parentModes) it(`${variant.name} / ${mode.name} parent`, async () => withParentMatrixFixture(variant, async ({ base, source, invoke }) => {
      const selected = { ...variant, paths: parentMatrixPaths(variant, mode) };
      const branches = mode.name === 'omitted' || variant.flags.includes('--no-ignore') ? expectedBranches[index] : ancestorBranches[index];
      for (const spelling of parentModeSpellings(mode, base)) {
        const { stdout, stderr } = await invoke('tree', source, ...variant.flags, ...spelling.flags);
        assert.equal(stderr, '', spelling.name);
        assert.equal(stdout, [source, ...branches, `1 directories, ${filePaths(selected).length} files, ${parentMatrixBytes(variant, mode)} file bytes`, ''].join('\n'), spelling.name);
      }
    }));
  });
  it('sorts multiple directories before files within every level', async () => withFixture(matrix[0], async ({ source, invoke }) => {
    await rm(source, { recursive: true, force: true });
    for (const dir of ['z-dir', 'a-dir/z-sub', 'a-dir/a-sub']) {
      await mkdir(path.join(source, dir), { recursive: true });
    }
    for (const file of ['z-file.txt', 'z-dir/z.txt', 'a-dir/z.txt', 'a-dir/a-sub/leaf.txt', 'a-file.txt', 'z-dir/a.txt', 'a-dir/a.txt']) {
      await writeFile(path.join(source, file), 'x');
    }
    const { stdout } = await invoke('tree', source, '--no-ignore');
    assert.equal(stdout, [
      source,
      '├── a-dir/',
      '│   ├── a-sub/',
      '│   │   └── leaf.txt',
      '│   ├── z-sub/',
      '│   ├── a.txt',
      '│   └── z.txt',
      '├── z-dir/',
      '│   ├── a.txt',
      '│   └── z.txt',
      '├── a-file.txt',
      '└── z-file.txt',
      '4 directories, 7 files, 7 file bytes',
      ''
    ].join('\n'));
  }));
  it('uses Ink for interactive tree output', async () => withFixture(matrix[2], async ({ bin, source }) => {
    const tty = await runCommandPty(process.execPath, bin, ['tree', source, ...matrix[2].flags]);
    assert.equal(tty.exit, 0);
    assert.match(tty.transcript, /\x1b\[/);
    assert.match(tty.transcript, /child\.txt/);
  }));
  it('requires force for parent-relative source and reports invalid source', async () => withFixture(matrix[0], async fixture => {
    await checkReadPathPolicy('tree', fixture);
    await assertCliError(fixture.invoke('tree', `${fixture.source}/missing`), /ENOENT/);
  }));
  it('draws the target using optional ancestor ignore scopes', async () => withParentFixture(async ({ source, parent, middle, target, invoke, invokeIn }) => {
    const expected = paths => [target, ...paths.map((name, index) => `${index === paths.length - 1 ? '└──' : '├──'} ${name}`), `0 directories, ${paths.length} files, ${parentBytes(paths)} file bytes`, ''].join('\n');
    assert.equal((await invoke('tree', target)).stdout, expected(parentPaths.default));
    assert.equal((await invoke('tree', target, '--parent', parent)).stdout, expected(parentPaths.selected));
    assert.equal((await invokeIn(parent, 'tree', target, '--parent', '')).stdout, expected(parentPaths.selected));
    await assertCliError(invoke('tree', target, '--parent', source), /--parent must be an ancestor/);
    await assertCliError(invokeIn(middle, 'tree', target, '--parent', '..'), /Relative parent path requires --force/);
  }));
});
