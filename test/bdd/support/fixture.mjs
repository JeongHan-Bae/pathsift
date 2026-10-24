import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cp, lstat, mkdtemp, mkdir, readFile, readdir, readlink, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const repository = fileURLToPath(new URL('../../../', import.meta.url));
const mode = process.env.PATHSIFT_TEST_MODE || 'compiled';
const artifactRoot = process.env.PATHSIFT_TEST_PACKAGE_ROOT || repository;
const modulesRoot = process.env.PATHSIFT_TEST_MODULES_ROOT || path.join(repository, 'node_modules');

export const matrix = [
  { name: 'zero ignore files', count: 0, flags: [], paths: ['always.txt', 'link-to-sub', 'one-only.txt', 'sub', 'sub/child.txt', 'sub/nested-ignore.txt', 'two-only.txt'] },
  { name: 'one ignore file', count: 1, flags: [], paths: ['.gitignore', 'always.txt', 'link-to-sub', 'sub', 'sub/.gitignore', 'sub/child.txt', 'two-only.txt'] },
  { name: 'two ignore files', count: 2, flags: ['--ignore-file', '.gitignore', '--ignore-file', '.deployignore'], paths: ['.deployignore', '.gitignore', 'always.txt', 'link-to-sub', 'sub', 'sub/.gitignore', 'sub/child.txt'] },
  { name: 'two files without global rules', count: 2, flags: ['--ignore-file', '.gitignore', '--ignore-file', '.deployignore', '--no-global-ignore'], paths: ['.deployignore', '.gitignore', 'always.txt', 'global-only.txt', 'link-to-sub', 'sub', 'sub/.gitignore', 'sub/child.txt'] },
  { name: 'two files with all filtering disabled', count: 2, flags: ['--ignore-file', '.gitignore', '--ignore-file', '.deployignore', '--no-ignore'], paths: ['.deployignore', '.gitignore', 'always.txt', 'global-only.txt', 'link-to-sub', 'one-only.txt', 'sub', 'sub/.gitignore', 'sub/child.txt', 'sub/nested-ignore.txt', 'two-only.txt'] }
];

export const contents = {
  '.deployignore': 'two-only.txt\n',
  '.gitignore': 'one-only.txt\n',
  'always.txt': 'abc',
  'global-only.txt': 'global',
  'one-only.txt': 'one',
  'sub/.gitignore': 'nested-ignore.txt\n',
  'sub/child.txt': 'child',
  'sub/nested-ignore.txt': 'nested',
  'two-only.txt': 'two'
};

export const kind = pathName => pathName === 'sub' ? 'dir' : pathName === 'link-to-sub' ? 'symlink' : 'file';
export const filePaths = variant => variant.paths.filter(p => kind(p) === 'file');
export const fileBytes = variant => filePaths(variant).reduce((total, p) => total + Buffer.byteLength(contents[p]), 0);
export const hashOf = p => createHash('sha256').update(contents[p]).digest('hex');
export const display = p => p + (kind(p) === 'dir' ? '/' : '');

export const parentContents = {
  '.gitignore': 'local.txt\n',
  'global-only.txt': 'global',
  'local.txt': 'local',
  'middle.txt': 'middle',
  'outer.txt': 'outer',
  'second.txt': 'second',
  'visible.txt': 'visible'
};
export const parentPaths = {
  default: ['.gitignore', 'middle.txt', 'outer.txt', 'second.txt', 'visible.txt'],
  selected: ['.gitignore', 'second.txt', 'visible.txt'],
  twoFiles: ['.gitignore', 'visible.txt'],
  noGlobal: ['.gitignore', 'global-only.txt', 'second.txt', 'visible.txt'],
  noIgnore: ['.gitignore', 'global-only.txt', 'local.txt', 'middle.txt', 'outer.txt', 'second.txt', 'visible.txt']
};
export const parentBytes = paths => paths.reduce((total, name) => total + Buffer.byteLength(parentContents[name]), 0);

export const parentModes = [
  { name: 'omitted', flags: () => [] },
  { name: 'empty', flags: () => ['--parent', ''] },
  { name: 'explicit', flags: base => ['--parent', base] }
];

export const parentModeSpellings = (mode, base) => mode.name === 'empty' ? [
  { name: 'value', flags: ['--parent', ''] },
  { name: 'bare', flags: ['--parent'] },
  { name: 'terminator', flags: ['--parent', '--'] },
  { name: 'option', flags: ['--parent', '--force'] }
] : [{ name: mode.name, flags: mode.flags(base) }];

export const parentMatrixPaths = (variant, mode) => {
  if (mode.name === 'omitted' || variant.flags.includes('--no-ignore')) return variant.paths;
  return variant.paths.filter(name =>
    !(variant.count >= 1 && name === 'always.txt') &&
    !(variant.count >= 2 && name === 'sub/child.txt'));
};

export const parentMatrixBytes = (variant, mode) => parentMatrixPaths(variant, mode)
  .filter(name => kind(name) === 'file')
  .reduce((total, name) => total + Buffer.byteLength(contents[name]), 0);

export async function withParentMatrixFixture(variant, fn) {
  return withFixture(variant, async fixture => {
    if (variant.count >= 1) await writeFile(path.join(fixture.base, '.gitignore'), 'source/always.txt\n');
    if (variant.count >= 2) await writeFile(path.join(fixture.base, '.deployignore'), 'source/sub/child.txt\n');
    await fn(fixture);
  });
}

export async function withParentFixture(fn) {
  return withFixture(matrix[0], async fixture => {
    const parent = path.join(fixture.base, 'parent');
    const middle = path.join(parent, 'middle');
    const target = path.join(middle, 'target');
    await mkdir(target, { recursive: true });
    await writeFile(path.join(parent, '.gitignore'), 'middle/target/outer.txt\n');
    await writeFile(path.join(parent, '.deployignore'), 'middle/target/second.txt\n');
    await writeFile(path.join(middle, '.gitignore'), 'target/middle.txt\n');
    for (const [name, value] of Object.entries(parentContents)) await writeFile(path.join(target, name), value);
    await fn({ ...fixture, parent, middle, target });
  });
}

export async function withFixture(variant, fn) {
  const base = await mkdtemp(path.join(tmpdir(), 'pathsift-bdd-'));
  try {
    const packageDir = path.join(base, 'package');
    const source = path.join(base, 'source');
    await mkdir(packageDir);
    await cp(path.join(artifactRoot, 'dist'), path.join(packageDir, 'dist'), { recursive: true });
    if (mode === 'source') {
      await cp(path.join(repository, 'bin'), path.join(packageDir, 'bin'), { recursive: true });
      await cp(path.join(repository, 'src'), path.join(packageDir, 'src'), { recursive: true });
    }
    await symlink(modulesRoot, path.join(packageDir, 'node_modules'), 'dir');
    await writeFile(path.join(packageDir, 'pathsift.config.json'), JSON.stringify({ ignoreFiles: ['.gitignore'], globalIgnore: 'global.ignore', hashVersion: 1, bufferLimitBytes: 1073741824 }));
    await writeFile(path.join(packageDir, 'global.ignore'), 'global-only.txt\n');
    await mkdir(path.join(source, 'sub'), { recursive: true });
    for (const [relative, value] of Object.entries(contents)) {
      if (relative === '.gitignore' || relative === 'sub/.gitignore') { if (variant.count < 1) continue; }
      if (relative === '.deployignore' && variant.count < 2) continue;
      await writeFile(path.join(source, relative), value);
    }
    await symlink('sub', path.join(source, 'link-to-sub'), 'dir');
    const bin = mode === 'source' ? path.join(packageDir, 'bin', 'pathsift.cjs') : path.join(packageDir, 'dist', 'boot', 'cli-main.js');
    const invoke = (...args) => exec(process.execPath, [bin, ...args], { cwd: base });
    const invokeIn = (cwd, ...args) => exec(process.execPath, [bin, ...args], { cwd });
    await fn({ base, packageDir, source, bin, invoke, invokeIn, variant });
  } finally { await rm(base, { recursive: true, force: true }); }
}

export async function assertCliError(promise, pattern) {
  await assert.rejects(promise, error => {
    assert.match(error.stderr, pattern);
    assert.equal(error.stdout, '');
    assert.notEqual(error.code, 0);
    return true;
  });
}

export async function actualPaths(root) {
  const result = [];
  async function visit(dir, prefix = '') {
    for (const name of await readdir(dir)) {
      const relative = prefix ? `${prefix}/${name}` : name;
      const info = await lstat(path.join(dir, name));
      result.push(relative);
      if (info.isDirectory()) await visit(path.join(dir, name), relative);
    }
  }
  await visit(root);
  return result.sort();
}

export async function assertCopied(source, destination, variant) {
  assert.deepEqual(await actualPaths(destination), [...variant.paths].sort());
  for (const p of filePaths(variant)) {
    assert.equal(await readFile(path.join(destination, p), 'utf8'), contents[p], p);
  }
  assert.equal(await readlink(path.join(destination, 'link-to-sub')), 'sub');
  assert.equal(await readlink(path.join(source, 'link-to-sub')), 'sub');
}

export async function checkReadPathPolicy(command, fixture) {
  const { base, source, invoke, invokeIn, variant } = fixture;
  const cwd = path.join(base, 'child');
  await mkdir(cwd);
  await assertCliError(invokeIn(cwd, command, '../source', ...variant.flags), /Relative parent path requires --force/);
  const forced = await invokeIn(cwd, command, '../source', '--force', ...variant.flags);
  assert.equal(forced.stderr, '');
  assert.ok(forced.stdout.length > 0);
  const absolute = await invoke(command, source, ...variant.flags);
  assert.equal(absolute.stderr, '');
  assert.ok(absolute.stdout.length > 0);
}
