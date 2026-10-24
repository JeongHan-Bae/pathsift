import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { matrix, withFixture, fileBytes, filePaths, checkReadPathPolicy, assertCliError } from './support/fixture.mjs';
import { runCommandPty } from './support/nano-pty.mjs';

const expectedBranches = [
  ['├── sub/', '│   ├── child.txt', '│   └── nested-ignore.txt', '├── always.txt', '├── link-to-sub@', '├── one-only.txt', '└── two-only.txt'],
  ['├── sub/', '│   ├── .gitignore', '│   └── child.txt', '├── .gitignore', '├── always.txt', '├── link-to-sub@', '└── two-only.txt'],
  ['├── sub/', '│   ├── .gitignore', '│   └── child.txt', '├── .deployignore', '├── .gitignore', '├── always.txt', '└── link-to-sub@'],
  ['├── sub/', '│   ├── .gitignore', '│   └── child.txt', '├── .deployignore', '├── .gitignore', '├── always.txt', '├── global-only.txt', '└── link-to-sub@'],
  ['├── sub/', '│   ├── .gitignore', '│   ├── child.txt', '│   └── nested-ignore.txt', '├── .deployignore', '├── .gitignore', '├── always.txt', '├── global-only.txt', '├── link-to-sub@', '├── one-only.txt', '└── two-only.txt']
];

describe('tree', () => {
  matrix.forEach((variant, index) => it(variant.name, async () => withFixture(variant, async ({ source, invoke }) => {
    const { stdout, stderr } = await invoke('tree', source, ...variant.flags);
    assert.equal(stderr, '');
    assert.equal(stdout, [source, ...expectedBranches[index], `1 directories, ${filePaths(variant).length} files, ${fileBytes(variant)} file bytes`, ''].join('\n'));
  })));
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
});
