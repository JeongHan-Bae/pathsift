import test from 'node:test';
import assert from 'node:assert/strict';
import { runCommand } from '../../dist/application/run.js';
import { createNodeFilesystemPorts } from '../../dist/adapters/node-filesystem.js';

for (const command of ['cp', 'archive']) {
  test(`${command} rejects a nonempty target before opening or scanning the source`, async () => {
    let opened = false;
    let walked = false;
    const ports = createNodeFilesystemPorts();
    ports.prepareDestination = async () => { throw new Error('target is not empty'); };
    ports.openSource = async () => { opened = true; return { close: async () => {} }; };
    ports.walk = async function* () { walked = true; yield {}; };
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
