export interface HelpCommand {
  name: string;
  arguments?: string;
  description: string;
}

export interface HelpOption {
  syntax: string;
  description: string;
}

export interface HelpDocument {
  title: string;
  commands: HelpCommand[];
  scanOptions: HelpOption[];
  generalOptions: HelpOption[];
  notes: string[];
}

export function createHelpDocument(): HelpDocument {
  return {
    title: 'pathsift — ignore-aware filesystem CLI',
    commands: [
      { name: 'tree', arguments: '[directory]', description: 'Draw directories first at each level, then files and counts' },
      { name: 'ls', arguments: '[directory]', description: 'List visible entries at the root only' },
      { name: 'find', arguments: '[directory]', description: 'List all visible relative paths' },
      { name: 'count', arguments: '[directory]', description: 'Count visible directories, regular files, and file bytes' },
      { name: 'du', arguments: '[directory]', description: 'Sum visible regular-file bytes (not Unix du)' },
      { name: 'hash', arguments: '[directory]', description: 'Path-and-content file hashes plus a tree hash' },
      { name: 'manifest', arguments: '[directory]', description: 'Write visible entries as JSON on stdout' },
      { name: 'cp', arguments: '<source-directory> <destination-directory>', description: 'Copy visible entries to a missing or empty directory' },
      { name: 'archive', arguments: '<source-directory> <output.zip|.tar|.tar.gz|.tgz>', description: 'Archive visible entries to a missing or empty file' },
      { name: 'nano', description: 'Edit package global.ignore; no arguments or scan options' },
      { name: 'config', description: 'Show package config, hash version, and buffer limit; no arguments or scan options' },
      { name: 'help', description: 'Show this help; no arguments or scan options' }
    ],
    scanOptions: [
      { syntax: '--ignore-file <filename>', description: 'Replace configured ignore filenames; repeatable' },
      { syntax: '--parent [directory]', description: 'Start ignore collection at ancestor; bare or "" means cwd; omitted means source' },
      { syntax: '--force', description: "Allow relative paths containing '..'" },
      { syntax: '--no-ignore', description: 'Disable all filtering' },
      { syntax: '--no-global-ignore', description: 'Disable global.ignore; keep directory rules' }
    ],
    generalOptions: [
      { syntax: '--help, -h', description: 'Show help for any invocation' }
    ],
    notes: [
      'Scan options apply to tree, ls, find, count, du, hash, manifest, cp, and archive.',
      'Every ignore filename uses Git-style rules, including .dockerignore.',
      'Selected ignore files are read along the parent-to-source path; sibling entries are untouched.',
      '--parent combines with every --ignore-file selection and filtering switch.',
      'Bare --parent also works before -- or another option.',
      '--no-ignore skips ancestor rules; --no-global-ignore keeps them.',
      'Symlinks are preserved but never traversed; exports skip their own empty output path.'
    ]
  };
}

export function renderHelp(document: HelpDocument): string {
  const usages = document.commands.map(command =>
    `pathsift ${command.name}${command.arguments ? ` ${command.arguments}` : ''}`
  );
  const width = Math.max(...usages.map(usage => usage.length));
  const commandLines = usages.map((usage, index) =>
    `  ${usage.padEnd(width)}  ${document.commands[index].description}`
  );
  const options = [...document.scanOptions, ...document.generalOptions];
  const optionWidth = Math.max(...options.map(option => option.syntax.length));
  const optionLines = (items: HelpOption[]) => items.map(option =>
    `  ${option.syntax.padEnd(optionWidth)}  ${option.description}`
  );
  return [
    document.title, '', 'Usage:', ...commandLines,
    '', 'Directory-command options:', ...optionLines(document.scanOptions),
    '', 'General option:', ...optionLines(document.generalOptions),
    '', ...document.notes, ''
  ].join('\n');
}
