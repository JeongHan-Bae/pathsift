import test from 'node:test';
import assert from 'node:assert/strict';
import { runCommand } from '../../dist/application/run.js';

for (const command of ['cp', 'archive']) {
  test(`${command} rejects a nonempty target before opening or scanning the source`, async () => {
    let opened = false;
    let walked = false;
    const ports = {
      resolve: value => value,
      isAbsolute: () => true,
      isSimpleFilename: () => true,
      prepareDestination: async () => { throw new Error('target is not empty'); },
      openSource: async () => { opened = true; return { close: async () => {} }; },
      walk: async function* () { walked = true; yield {}; }
    };
    await assert.rejects(runCommand({
      cmd: command,
      args: ['source', 'destination'],
      opts: {},
      config: { ignoreFiles: ['.gitignore'], globalPath: 'global.ignore', hashVersion: 1, bufferLimitBytes: 1073741824 }
    }, ports), /target is not empty/);
    assert.equal(opened, false);
    assert.equal(walked, false);
  });
}
