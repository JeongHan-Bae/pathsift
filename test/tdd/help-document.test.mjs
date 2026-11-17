import test from 'node:test';
import assert from 'node:assert/strict';
import { createHelpDocument, createCommandHelpDocument, renderHelp, renderHelpLines } from '../../dist/adapters/output/cli-help.js';

test('help document contains the complete structured command and option contracts', () => {
  const document = createHelpDocument();
  const noteText = note => typeof note === 'string' ? note : note.map(part => part.text).join('');
  const commands = new Map(document.commands.map(command => [command.name, command]));
  const expected = ['tree', 'ls', 'find', 'where', 'count', 'du', 'hash', 'manifest', 'cp', 'archive', 'nano', 'config', 'help'];
  assert.deepEqual([...commands.keys()].sort(), expected.sort());
  for (const command of commands.values()) assert.ok(command.description.length > 0);
  assert.equal(commands.get('nano').arguments, undefined);
  assert.equal(commands.get('config').arguments, undefined);
  assert.match(commands.get('archive').arguments, /\.zip/);
  const options = new Map(document.scanOptions.map(option => [option.syntax, option.description]));
  assert.deepEqual([...options.keys()].sort(), [
    '--ignore-file <filename>', '--parent [directory]', '--no-ignore', '--no-global-ignore', '--force'
  ].sort());
  assert.ok(options.get('--force').includes('..'));
  for (const term of ['ancestor', 'bare', 'cwd', 'source']) assert.ok(options.get('--parent [directory]').includes(term));
  assert.ok(document.generalOptions.some(option => option.syntax === '--help, -h'));
  assert.ok(document.notes.some(note => note.includes('Git-style')));
  assert.ok(document.notes.some(note => note.includes('ancestor scopes apply')));
  assert.ok(document.notes.some(note => noteText(note).includes('--parent combines with --ignore-file')));
  assert.equal(document.commands.find(command => command.name === 'where').arguments, '[directory] <query> [options]');
  assert.equal(document.findOptions.length, 9);
  assert.match(document.findOptions.find(option => option.syntax === '--type <type>').description, /text, binary/);
  assert.equal(document.whereOptions.length, 3);
  assert.equal(createCommandHelpDocument('find').commands[0].name, 'find');
  assert.ok(createCommandHelpDocument('find').notes.some(note => note.includes('POSIX find-compatible')));
  assert.equal(createCommandHelpDocument('where').commands[0].name, 'where');
});

test('every executable command has a concise, scoped help document', () => {
  const names = ['tree', 'ls', 'find', 'where', 'count', 'du', 'hash', 'manifest', 'cp', 'archive', 'nano', 'config'];
  for (const name of names) {
    const document = createCommandHelpDocument(name);
    assert.equal(document.commands.length, 1);
    assert.equal(document.commands[0].name, name);
    assert.ok(document.examples.length > 0, name);
    assert.ok(document.notes.length > 0, name);
    assert.ok(document.generalOptions.some(option => option.syntax.includes('--help')));
    assert.equal(document.scanOptions.length > 0, !['nano', 'config'].includes(name), name);
    assert.equal(Boolean(document.findOptions?.length), name === 'find', name);
    assert.equal(Boolean(document.whereOptions?.length), name === 'where', name);
  }
  assert.equal(createCommandHelpDocument('missing'), undefined);
});

test('plain and TTY help share semantic lines from the structured document', () => {
  const document = createCommandHelpDocument('find');
  const lines = renderHelpLines(document);
  const plain = renderHelp(document);
  assert.match(plain, /`pathsift find \[directory] \[options]`\s+List and filter visible relative paths/);
  assert.match(plain, /`--type <type>`\s+file, dir, symlink/);
  assert.match(plain, /`--name` matches the basename; `--max-depth` stops recursion/);
  assert.ok(!plain.includes('\x1b['));
  assert.equal(lines[0].role, 'title');
  assert.ok(lines.some(line => line.role === 'heading' && line.text === 'Find filters:'));
  assert.ok(lines.some(line => line.role === 'usage' && line.text.includes('pathsift find')));
  assert.ok(lines.some(line => line.role === 'example' && line.text.includes('pathsift find')));
  const usage = lines.find(line => line.role === 'usage');
  assert.deepEqual(usage.parts.filter(part => part.role === 'code').map(part => part.text), ['pathsift find [directory] [options]']);
  assert.ok(usage.parts.some(part => part.role === 'plain' && part.text.includes('List and filter visible relative paths')));
  const option = lines.find(line => line.role === 'option' && line.text.includes('--type <type>'));
  assert.deepEqual(option.parts.filter(part => part.role === 'code').map(part => part.text), ['--type <type>']);
  assert.ok(option.parts.some(part => part.role === 'plain' && part.text.includes('file, dir, symlink')));
  const explanation = lines.find(line => line.role === 'note' && line.text.includes('--name matches the basename'));
  assert.deepEqual(explanation.parts.filter(part => part.role === 'code').map(part => part.text), ['--name', '--max-depth']);
  assert.ok(explanation.parts.some(part => part.role === 'plain' && part.text.includes('matches the basename')));
});

test('narrow TTY help stacks explanations below syntax instead of wrapping columns', () => {
  for (const columns of [40, 80]) {
    for (const document of [createHelpDocument(), createCommandHelpDocument('find'), createCommandHelpDocument('archive')]) {
      assert.ok(renderHelpLines(document, columns).every(line => line.text.length <= columns), `${columns} / ${document.title}`);
    }
  }
  const lines = renderHelpLines(createHelpDocument(), 80);
  const usage = lines.findIndex(line => line.text.trim() === 'pathsift tree [directory]');
  assert.ok(usage >= 0);
  assert.equal(lines[usage].parts.find(part => part.role === 'code').text, 'pathsift tree [directory]');
  assert.match(lines[usage + 1].text, /^ {4}Draw directories first/);
  assert.ok(!lines[usage + 1].parts?.some(part => part.role === 'code'));
  const option = lines.findIndex(line => line.text.trim() === '--ignore-file <filename>');
  assert.ok(option >= 0);
  assert.match(lines[option + 1].text, /^ {4}Replace configured ignore filenames/);
  assert.ok(!lines[option + 1].parts?.some(part => part.role === 'code'));
});
