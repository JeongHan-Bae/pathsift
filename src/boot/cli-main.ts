#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { loadConfig, configPath } from '../adapters/config.ts';
import { editGlobalIgnore } from '../adapters/nano.ts';
import { runCommand } from '../application/run.ts';
import { createNodeFilesystemPorts } from '../adapters/node-filesystem.ts';
import { createHelpDocument } from '../adapters/output/cli-help.ts';
import { printCommand, printHelp } from '../adapters/output/terminal-output.ts';

const scanOptionNames = ['ignore-file', 'no-ignore', 'no-global-ignore', 'force'] as const;

function rejectIrrelevantOptions(command: string, options: Record<string, unknown>): void {
  const option = scanOptionNames.find(name => options[name] !== undefined);
  if (option) throw new Error(`${command} does not accept --${option}`);
}

async function main() {
  const { values: opts, positionals } = parseArgs({
    args: process.argv.slice(2), allowPositionals: true, strict: true,
    options: {
      'ignore-file': { type: 'string', multiple: true },
      'no-ignore': { type: 'boolean' },
      'force': { type: 'boolean' },
      'no-global-ignore': { type: 'boolean' },
      'help': { type: 'boolean', short: 'h' }
    }
  });
  const [cmd, ...args] = positionals;
  if (opts.help) { await printHelp(createHelpDocument()); return; }
  if (!cmd) {
    rejectIrrelevantOptions('help', opts);
    await printHelp(createHelpDocument());
    return;
  }
  if (cmd === 'help') {
    if (args.length) throw new Error('help takes no positional arguments');
    rejectIrrelevantOptions('help', opts);
    await printHelp(createHelpDocument());
    return;
  }
  const config = await loadConfig();
  if (cmd === 'config') {
    if (args.length) throw new Error('config takes no positional arguments');
    rejectIrrelevantOptions('config', opts);
    await printCommand({ kind: 'text', lines: [`config: ${configPath}`, `global ignore: ${config.globalPath}`, `ignore files: ${config.ignoreFiles.join(', ')}`, `hash version: ${config.hashVersion}`, `buffer limit: ${config.bufferLimitBytes} bytes`] });
    return;
  }
  if (cmd === 'nano') {
    if (args.length) throw new Error('nano takes no positional arguments');
    rejectIrrelevantOptions('nano', opts);
    await editGlobalIgnore(config.globalPath);
    return;
  }
  const result = await runCommand({ cmd, args, opts, config }, createNodeFilesystemPorts());
  await printCommand(result);
}

main().catch(error => {
  console.error('pathsift: ' + error.message);
  process.exitCode = 1;
});
