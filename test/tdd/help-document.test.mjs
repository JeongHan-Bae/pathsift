import test from 'node:test';
import assert from 'node:assert/strict';
import { createHelpDocument } from '../../dist/adapters/output/cli-help.js';

test('help document contains the complete structured command and option contracts', () => {
  const document = createHelpDocument();
  const commands = new Map(document.commands.map(command => [command.name, command]));
  const expected = ['tree', 'ls', 'find', 'count', 'du', 'hash', 'manifest', 'cp', 'archive', 'nano', 'config', 'help'];
  assert.deepEqual([...commands.keys()].sort(), expected.sort());
  for (const command of commands.values()) assert.ok(command.description.length > 0);
  assert.equal(commands.get('nano').arguments, undefined);
  assert.equal(commands.get('config').arguments, undefined);
  assert.match(commands.get('archive').arguments, /\.zip/);
  const options = new Map(document.scanOptions.map(option => [option.syntax, option.description]));
  assert.deepEqual([...options.keys()].sort(), [
    '--ignore-file <filename>', '--no-ignore', '--no-global-ignore', '--force'
  ].sort());
  assert.ok(options.get('--force').includes('..'));
  assert.ok(document.generalOptions.some(option => option.syntax === '--help, -h'));
  assert.ok(document.notes.some(note => note.includes('Git-style')));
});
