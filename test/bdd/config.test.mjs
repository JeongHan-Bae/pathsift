import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { realpath, writeFile } from 'node:fs/promises';
import { matrix, withFixture, assertCliError } from './support/fixture.mjs';

describe('config', () => {
  it('prints package-local config, global ignore, and configured filenames', async () => withFixture(matrix[0], async ({ packageDir, invoke }) => {
    const { stdout, stderr } = await invoke('config');
    assert.equal(stderr, '');
    const canonical = await realpath(packageDir);
    assert.equal(stdout, `config: ${path.join(canonical, 'pathsift.config.json')}\nglobal ignore: ${path.join(canonical, 'global.ignore')}\nignore files: .gitignore\nhash version: 1\nbuffer limit: 1073741824 bytes\n`);
  }));
  it('rejects an unknown configured hash version', async () => withFixture(matrix[0], async ({ packageDir, invoke }) => {
    await writeFile(path.join(packageDir, 'pathsift.config.json'), JSON.stringify({ ignoreFiles: ['.gitignore'], globalIgnore: 'global.ignore', hashVersion: 2, bufferLimitBytes: 1073741824 }));
    await assertCliError(invoke('config'), /Unsupported configuration hashVersion: 2; expected 1/);
  }));
  it('rejects a config that omits the hash version', async () => withFixture(matrix[0], async ({ packageDir, invoke }) => {
    await writeFile(path.join(packageDir, 'pathsift.config.json'), JSON.stringify({ ignoreFiles: ['.gitignore'], globalIgnore: 'global.ignore', bufferLimitBytes: 1073741824 }));
    await assertCliError(invoke('config'), /Unsupported configuration hashVersion: undefined; expected 1/);
  }));
  it('rejects a zero buffer limit', async () => withFixture(matrix[0], async ({ packageDir, invoke }) => {
    await writeFile(path.join(packageDir, 'pathsift.config.json'), JSON.stringify({ ignoreFiles: ['.gitignore'], globalIgnore: 'global.ignore', hashVersion: 1, bufferLimitBytes: 0 }));
    await assertCliError(invoke('config'), /bufferLimitBytes.*positive safe integer/);
  }));
  it('refuses scan options', async () => withFixture(matrix[0], ({ invoke }) => assertCliError(invoke('config', '--no-ignore'), /config does not accept --no-ignore/)));
  it('refuses positional arguments', async () => withFixture(matrix[0], ({ invoke }) => assertCliError(invoke('config', 'extra'), /config takes no positional arguments/)));
});
