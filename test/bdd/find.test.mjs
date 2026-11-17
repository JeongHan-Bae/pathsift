import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { matrix, withFixture, withParentFixture, withParentMatrixFixture, parentModes, parentModeSpellings, parentMatrixPaths, parentPaths, display, checkReadPathPolicy, assertCliError } from './support/fixture.mjs';

describe('find', () => {
  for (const variant of matrix) for (const mode of parentModes) it(`${variant.name} / ${mode.name} parent`, async () => withParentMatrixFixture(variant, async ({ base, source, invoke }) => {
    for (const spelling of parentModeSpellings(mode, base)) {
      const { stdout, stderr } = await invoke('find', source, ...variant.flags, ...spelling.flags);
      assert.equal(stderr, '', spelling.name);
      assert.equal(stdout, parentMatrixPaths(variant, mode).map(display).join('\n') + '\n', spelling.name);
    }
  }));
  it('treats .dockerignore as a Git-style filename with nested scopes', async () => withFixture(matrix[2], async ({ source, invoke }) => {
    await writeFile(path.join(source, '.dockerignore'), 'one-only.txt\n');
    await writeFile(path.join(source, 'sub', '.dockerignore'), 'nested-ignore.txt\n');
    const { stdout } = await invoke('find', source, '--ignore-file', '.dockerignore');
    assert.deepEqual(stdout.trimEnd().split('\n'), [
      '.deployignore', '.dockerignore', '.gitignore', 'always.txt', 'link-to-sub',
      'sub/', 'sub/.dockerignore', 'sub/.gitignore', 'sub/child.txt', 'two-only.txt'
    ]);
  }));
  it('requires force for parent-relative source', async () => withFixture(matrix[0], fixture => checkReadPathPolicy('find', fixture)));
  it('loads only selected ancestor scopes and accepts an empty parent as cwd', async () => withParentFixture(async ({ source, parent, middle, target, invoke, invokeIn }) => {
    const paths = async (...args) => (await invoke('find', target, ...args)).stdout.trimEnd().split('\n');
    assert.deepEqual(await paths(), parentPaths.default);
    assert.deepEqual(await paths('--parent', target), parentPaths.default);
    assert.deepEqual(await paths('--parent', parent), parentPaths.selected);
    assert.deepEqual((await invokeIn(parent, 'find', target, '--parent', '')).stdout.trimEnd().split('\n'), parentPaths.selected);
    assert.deepEqual((await invokeIn(parent, 'find', target, '--parent')).stdout.trimEnd().split('\n'), parentPaths.selected);
    assert.deepEqual((await invokeIn(parent, 'find', target, '--parent', '--')).stdout.trimEnd().split('\n'), parentPaths.selected);
    assert.deepEqual((await invokeIn(parent, 'find', target, '--parent', '--no-global-ignore')).stdout.trimEnd().split('\n'), parentPaths.noGlobal);
    assert.deepEqual(await paths('--parent', parent, '--ignore-file', '.gitignore', '--ignore-file', '.deployignore'), parentPaths.twoFiles);
    assert.deepEqual(await paths('--parent', parent, '--no-global-ignore'), parentPaths.noGlobal);
    assert.deepEqual(await paths('--parent', parent, '--no-ignore'), parentPaths.noIgnore);
    await assertCliError(invoke('find', target, '--parent', source), /--parent must be an ancestor/);
    await assertCliError(invokeIn(source, 'find', target, '--parent', ''), /--parent must be an ancestor/);
    await assertCliError(invokeIn(middle, 'find', target, '--parent', '..'), /Relative parent path requires --force/);
    assert.deepEqual((await invokeIn(middle, 'find', target, '--parent', '..', '--force')).stdout.trimEnd().split('\n'), parentPaths.selected);
  }));
  it('filters types and names without changing walker order', async () => withFixture(matrix[0], async ({ source, invoke }) => {
    assert.equal((await invoke('find', source, '--type', 'file')).stdout, 'always.txt\none-only.txt\nsub/child.txt\nsub/nested-ignore.txt\ntwo-only.txt\n');
    assert.equal((await invoke('find', source, '--type', 'd')).stdout, 'sub/\n');
    assert.equal((await invoke('find', source, '--type', 'l')).stdout, 'link-to-sub\n');
    assert.equal((await invoke('find', source, '--name', 's*')).stdout, 'sub/\n');
    assert.equal((await invoke('find', source, '--name', '*.txt', '--type', 'f')).stdout, 'always.txt\none-only.txt\nsub/child.txt\nsub/nested-ignore.txt\ntwo-only.txt\n');
  }));
  it('filters depth, byte size and modification time with AND', async () => withFixture(matrix[0], async ({ source, invoke }) => {
    const old = new Date(Date.now() - 365 * 86400000);
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    await utimes(path.join(source, 'one-only.txt'), old, old);
    assert.equal((await invoke('find', source, '--max-depth', '0')).stdout, '');
    assert.equal((await invoke('find', source, '--max-depth', '1')).stdout, 'always.txt\nlink-to-sub\none-only.txt\nsub/\ntwo-only.txt\n');
    assert.equal((await invoke('find', source, '--min-depth', '2')).stdout, 'sub/child.txt\nsub/nested-ignore.txt\n');
    assert.equal((await invoke('find', source, '--min-size', '5B')).stdout, 'sub/child.txt\nsub/nested-ignore.txt\n');
    assert.equal((await invoke('find', source, '--modified-before', cutoff)).stdout, 'one-only.txt\n');
    assert.equal((await invoke('find', source, '--modified-older-than', '1d', '--type', 'file')).stdout, 'one-only.txt\n');
    assert.equal((await invoke('find', source, '--modified-within', '1d', '--type', 'file', '--name', '*.txt', '--min-depth', '2', '--max-depth', '2', '--min-size', '5B', '--max-size', '6B')).stdout, 'sub/child.txt\nsub/nested-ignore.txt\n');
  }));
  it('preserves literal option terminator semantics and rejects invalid find filters', async () => withFixture(matrix[0], async ({ base, source, invoke, invokeIn }) => {
    await mkdir(path.join(base, '--directory'));
    await writeFile(path.join(base, '--directory', 'visible.txt'), '');
    assert.equal((await invokeIn(base, 'find', '--')).stdout.includes('source/'), true);
    assert.equal((await invokeIn(base, 'find', '--', '--directory')).stdout, 'visible.txt\n');
    assert.equal((await invoke('find', source, '--')).stdout.includes('sub/child.txt\n'), true);
    for (const args of [
      ['--type', 'unknown'], ['--type', 'file', '--type', 'dir'], ['--name', '[bad'],
      ['--max-depth=-1'], ['--min-depth', '2', '--max-depth', '1'],
      ['--min-size', '1MB'], ['--min-size', '2B', '--max-size', '1B'],
      ['--modified-within', '0d'], ['--modified-before', '2026-02-30']
    ]) await assertCliError(invoke('find', source, ...args), /Invalid|cannot be repeated|exceeds|where requires/i);
    await assertCliError(invoke('find', source, '--', '--type'), /extra positional/);
    await assertCliError(invoke('find', source, '--', '--name', '*.ts'), /extra positional/);
    await assertCliError(invoke('tree', source, '--type', 'file'), /does not accept --type/);
    await assertCliError(invoke('ls', source, '--contains'), /does not accept --contains/);
  }));
  it('uses encoding to distinguish Java source with PDF text from PDF bytes', async () => withFixture(matrix[0], async ({ source, invoke }) => {
    const content = path.join(source, 'content');
    await mkdir(content);
    await writeFile(path.join(content, 'example.java'), 'package example;\nString signature = "%PDF-1.4";\n');
    await writeFile(path.join(content, 'not-pdf.pdf'), '%PDF-1.4\n\nthis is pure text, not pdf.\n');
    await writeFile(path.join(content, 'document.pdf'), Buffer.from([37, 80, 68, 70, 45, 49, 46, 52, 10, 37, 226, 227, 207, 211, 10, 49, 32, 48, 32, 111, 98, 106, 10]));
    await writeFile(path.join(content, 'empty.txt'), '');
    await writeFile(path.join(content, 'data.txt'), Buffer.from([0, 1, 2, 3]));
    await writeFile(path.join(content, 'utf16.txt'), Buffer.from([0xff, 0xfe, 0x48, 0, 0x69, 0]));
    await writeFile(path.join(content, 'late.bin'), Buffer.concat([Buffer.from('A'.repeat(200000)), Buffer.from([0, 1, 2, 3])]));
    assert.equal((await invoke('find', content, '--type', 'file')).stdout, 'data.txt\ndocument.pdf\nempty.txt\nexample.java\nlate.bin\nnot-pdf.pdf\nutf16.txt\n');
    assert.equal((await invoke('find', content, '--type', 'text')).stdout, 'empty.txt\nexample.java\nnot-pdf.pdf\nutf16.txt\n');
    assert.equal((await invoke('find', content, '--type', 'binary')).stdout, 'data.txt\ndocument.pdf\nlate.bin\n');
  }));
  it('keeps long non-ASCII YAML and Markdown text after tail sampling', async () => withFixture(matrix[0], async ({ source, invoke }) => {
    const content = path.join(source, 'content');
    await mkdir(content);
    await writeFile(path.join(content, 'large.yaml'), 'summary: \u793a\u4f8b\u6587\u5b57 `state`\uff1a\u8fd8\u6709\u4e00\u884c\u5185\u5bb9\u3002\n'.repeat(3000));
    await writeFile(path.join(content, 'large.md'), '# \u793a\u4f8b\u6807\u9898\n\u666e\u901a\u6587\u5b57 `state`\uff1a\u8fd8\u6709\u4e00\u884c\u5185\u5bb9\u3002\n'.repeat(3000) + 'aa');
    assert.equal((await invoke('find', content, '--type', 'text')).stdout, 'large.md\nlarge.yaml\n');
    assert.equal((await invoke('find', content, '--type', 'binary')).stdout, '');
  }));
  it('treats JSON and JSON Lines as text while JSONB bytes remain binary', async () => withFixture(matrix[0], async ({ source, invoke }) => {
    const content = path.join(source, 'content');
    await mkdir(content);
    await writeFile(path.join(content, 'one.json'), '{"name":"sample"}\n');
    await writeFile(path.join(content, 'lines.jsonl'), '{"n":1}\n{"n":2}\n');
    await writeFile(path.join(content, 'data.jsonb'), Buffer.from([1, 0, 0, 0, 0, 0, 0, 0, 0]));
    assert.equal((await invoke('find', content, '--type', 'text')).stdout, 'lines.jsonl\none.json\n');
    assert.equal((await invoke('find', content, '--type', 'binary')).stdout, 'data.jsonb\n');
  }));
  it('keeps ZIP content binary even with a misleading text extension', async () => withFixture(matrix[0], async ({ source, invoke }) => {
    const content = path.join(source, 'content');
    await mkdir(content);
    await writeFile(path.join(content, 'archive.txt'), Buffer.from('504b0506000000000000000000000000000000000000', 'hex'));
    assert.equal((await invoke('find', content, '--type', 'binary')).stdout, 'archive.txt\n');
    assert.equal((await invoke('find', content, '--type', 'text')).stdout, '');
  }));
});
