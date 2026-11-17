#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { loadConfig, configPath } from '../adapters/config.ts';
import { editGlobalIgnore } from '../adapters/nano.ts';
import { runCommand } from '../application/run.ts';
import { createNodeFilesystemPorts } from '../adapters/node-filesystem.ts';
import { createHelpDocument, createCommandHelpDocument } from '../adapters/output/cli-help.ts';
import { printCommand, printHelp } from '../adapters/output/terminal-output.ts';
import { selectWhereMode } from './where-options.ts';
import { parseFindOptions, type FindOptionName } from '../core/find-filter.ts';
import type { OutputChunk } from '../core/output.ts';
import { BoundedOutputStager, DEFAULT_OUTPUT_STAGE_CAPACITY } from '../std/bounded-output-stager.ts';

const scanOptionNames = ['ignore-file', 'no-ignore', 'no-global-ignore', 'parent', 'force'] as const;
const matchingOptionNames = ['exact', 'contains', 'glob'] as const;
const findOptionNames: FindOptionName[] = ['type', 'name', 'min-depth', 'max-depth', 'min-size', 'max-size', 'modified-within', 'modified-older-than', 'modified-before'];

function normalizeParentArgs(args: string[]): string[] {
  let afterTerminator = false;
  return args.map((value, index) => {
    if (value === '--') afterTerminator = true;
    if (!afterTerminator && value === '--parent' && (index === args.length - 1 || args[index + 1].startsWith('-'))) {
      return '--parent=';
    }
    return value;
  });
}

function rejectIrrelevantOptions(command: string, options: Record<string, unknown>): void {
  const option = [...scanOptionNames, ...matchingOptionNames, ...findOptionNames].find(name => options[name] !== undefined);
  if (option) throw new Error(`${command} does not accept --${option}`);
}

async function main() {
  const { values: opts, positionals } = parseArgs({
    args: normalizeParentArgs(process.argv.slice(2)), allowPositionals: true, strict: true,
    options: {
      'ignore-file': { type: 'string', multiple: true },
      'parent': { type: 'string' },
      'no-ignore': { type: 'boolean' },
      'force': { type: 'boolean' },
      'no-global-ignore': { type: 'boolean' },
      'exact': { type: 'boolean', short: 'e', multiple: true },
      'contains': { type: 'boolean', short: 'c', multiple: true },
      'glob': { type: 'boolean', short: 'g', multiple: true },
      'type': { type: 'string', multiple: true },
      'name': { type: 'string', multiple: true },
      'min-depth': { type: 'string', multiple: true },
      'max-depth': { type: 'string', multiple: true },
      'min-size': { type: 'string', multiple: true },
      'max-size': { type: 'string', multiple: true },
      'modified-within': { type: 'string', multiple: true },
      'modified-older-than': { type: 'string', multiple: true },
      'modified-before': { type: 'string', multiple: true },
      'help': { type: 'boolean', short: 'h' }
    }
  });
  const [cmd, ...args] = positionals;
  if (opts.help) { await printHelp(createCommandHelpDocument(cmd || '') || createHelpDocument()); return; }
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
  const modes = matchingOptionNames.filter(name => opts[name] !== undefined);
  if (cmd !== 'where' && modes.length) throw new Error(`${cmd} does not accept --${modes[0]}`);
  const findOptions = findOptionNames.filter(name => opts[name] !== undefined);
  if (cmd !== 'find' && findOptions.length) throw new Error(`${cmd} does not accept --${findOptions[0]}`);
  const matchMode = cmd === 'where' ? selectWhereMode(opts) : undefined;
  const findFilter = cmd === 'find' ? parseFindOptions(opts, Date.now()) : undefined;
  const result = await runCommand({ cmd, args, opts: { ...opts, matchMode, findFilter }, config }, createNodeFilesystemPorts());
  await printCommand(result, process.stdout, new BoundedOutputStager<OutputChunk>(DEFAULT_OUTPUT_STAGE_CAPACITY));
}

main().catch(error => {
  console.error('pathsift: ' + error.message);
  process.exitCode = 1;
});
