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
  scope?: 'global' | 'command';
  title: string;
  commands: HelpCommand[];
  scanOptions: HelpOption[];
  findOptions?: HelpOption[];
  whereOptions?: HelpOption[];
  generalOptions: HelpOption[];
  notes: Array<string | HelpPart[]>;
  examples?: string[];
}

const code = (text: string): HelpPart => ({ text, role: 'code' });
const rich = (...parts: Array<string | HelpPart>): HelpPart[] =>
  parts.map(part => typeof part === 'string' ? { text: part, role: 'plain' } : part);

export function createHelpDocument(): HelpDocument {
  return {
    scope: 'global',
    title: 'pathsift — ignore-aware filesystem CLI',
    commands: [
      { name: 'tree', arguments: '[directory]', description: 'Draw directories first at each level, then files and counts' },
      { name: 'ls', arguments: '[directory]', description: 'List visible entries at the root only' },
      { name: 'find', arguments: '[directory] [options]', description: 'List and filter visible relative paths' },
      { name: 'where', arguments: '[directory] <query> [options]', description: 'Find visible regular files by case-sensitive filename' },
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
    findOptions: [
      { syntax: '--type <type>', description: 'file, dir, symlink, text, binary; f, d, l aliases' },
      { syntax: '--name <glob>', description: 'Case-sensitive basename Glob' },
      { syntax: '--min-depth <n>', description: 'Minimum output depth' },
      { syntax: '--max-depth <n>', description: 'Maximum traversal depth' },
      { syntax: '--min-size <size>', description: 'Minimum regular-file bytes (B, KiB, MiB, GiB, TiB)' },
      { syntax: '--max-size <size>', description: 'Maximum regular-file bytes' },
      { syntax: '--modified-within <duration>', description: 'Modified within 1s, 2m, 3h, 4d, or 5w' },
      { syntax: '--modified-older-than <duration>', description: 'Modified strictly earlier than now minus duration' },
      { syntax: '--modified-before <YYYY-MM-DD>', description: 'Modified before UTC date start' }
    ],
    whereOptions: [
      { syntax: '-e, --exact', description: 'Exact filename (default)' },
      { syntax: '-c, --contains', description: 'Literal substring' },
      { syntax: '-g, --glob', description: 'Whole-filename glob: *, ?, [abc], [a-z]' }
    ],
    generalOptions: [
      { syntax: '--help, -h', description: 'Show help for any invocation' }
    ],
    notes: [
      rich('Scan options apply to ', ...['tree', 'ls', 'find', 'where', 'count', 'du', 'hash', 'manifest', 'cp', 'archive'].flatMap((name, index) => index ? [', ', code(name)] : [code(name)]), '.'),
      rich(code('--'), ' ends options; bare ', code('--parent'), ' uses cwd, including before ', code('--'), '.'),
      'Ignore files use Git-style rules, including .dockerignore; ancestor scopes apply.',
      rich(code('--parent'), ' combines with ', code('--ignore-file'), ' and filtering switches.'),
      'Symlinks are not traversed; exports skip their own empty output path.',
      rich('Use ', code('pathsift <command> --help'), ' for command details.')
    ]
  };
}

const commandDetails: Record<string, { notes: HelpDocument['notes']; examples: string[] }> = {
  tree: { notes: ['Directory defaults to cwd; directories appear before files.'], examples: ['pathsift tree ./project'] },
  ls: { notes: ['Directory defaults to cwd; lists root entries only.'], examples: ['pathsift ls ./project'] },
  find: { notes: ['Project filters use AND; not POSIX find-compatible.', rich(code('--name'), ' matches the basename; ', code('--max-depth'), ' stops recursion.'), 'Outputs visible relative paths; directory defaults to cwd.', rich('Text/binary rules: ', code('docs/content-types.md'), '.')], examples: ['pathsift find', "pathsift find ./src --type file --name '*.ts'"] },
  where: { notes: ['One query uses cwd; two use directory then query.', rich('Modes are exclusive and case-sensitive; ', code('--'), ' ends options.'), 'Matches regular-file basenames after ignore filtering.'], examples: ['pathsift where config.ts', "pathsift where ./src '*.ts' --glob"] },
  count: { notes: ['Directory defaults to cwd; counts visible directories, files, and bytes.'], examples: ['pathsift count ./project'] },
  du: { notes: ['Directory defaults to cwd; sums visible regular-file bytes.'], examples: ['pathsift du ./project'] },
  hash: { notes: ['Directory defaults to cwd; hashes visible file paths and contents.'], examples: ['pathsift hash ./project'] },
  manifest: { notes: ['Directory defaults to cwd; writes plain JSON to stdout.'], examples: ['pathsift manifest ./project'] },
  cp: { notes: ['Source and destination are required; destination must be missing or empty.', 'Preserves symlinks and rolls back handled write failures.'], examples: ['pathsift cp ./project ./backup'] },
  archive: { notes: ['Source and output are required; output must be missing or empty.', 'Preserves symlinks and rolls back handled write failures.'], examples: ['pathsift archive ./project ./project.tar.gz'] },
  nano: { notes: ['Requires a TTY; edits only the package global.ignore file.'], examples: ['pathsift nano'] },
  config: { notes: ['Shows the package config and global ignore locations.'], examples: ['pathsift config'] }
};

export function createCommandHelpDocument(name: string): HelpDocument | undefined {
  const details = commandDetails[name];
  if (!details) return undefined;
  const general = createHelpDocument();
  const command = general.commands.find(item => item.name === name)!;
  const scans = name !== 'nano' && name !== 'config';
  return {
    scope: 'command',
    title: `pathsift ${name} — ${command.description}`,
    commands: [command],
    scanOptions: scans ? general.scanOptions : [],
    findOptions: name === 'find' ? general.findOptions : undefined,
    whereOptions: name === 'where' ? general.whereOptions : undefined,
    generalOptions: general.generalOptions,
    notes: details.notes,
    examples: details.examples
  };
}

export interface HelpLine {
  text: string;
  role: 'title' | 'heading' | 'usage' | 'option' | 'note' | 'example' | 'blank';
  parts?: HelpPart[];
}

export interface HelpPart {
  text: string;
  role: 'plain' | 'code';
}

function wrapWords(value: string, width: number): string[] {
  const limit = Math.max(1, Math.floor(width));
  const rows: string[] = [];
  let row = '';
  for (const word of value.trim().split(/\s+/u)) {
    if (row && row.length + 1 + word.length > limit) {
      rows.push(row);
      row = '';
    }
    if (word.length > limit) {
      for (let offset = 0; offset < word.length; offset += limit) {
        const chunk = word.slice(offset, offset + limit);
        if (chunk.length === limit) rows.push(chunk);
        else row = chunk;
      }
    } else row = row ? row + ' ' + word : word;
  }
  if (row) rows.push(row);
  return rows.length ? rows : [''];
}

function wrapParts(parts: HelpPart[], width: number): HelpPart[][] {
  const limit = Math.max(1, Math.floor(width));
  const rows: HelpPart[][] = [];
  let row: HelpPart[] = [];
  let used = 0;
  let pendingSpace = false;
  const flush = () => {
    if (row.length) rows.push(row);
    row = [];
    used = 0;
  };
  for (const part of parts) for (const chunk of part.text.split(/(\s+)/u)) {
    if (!chunk) continue;
    if (/^\s+$/u.test(chunk)) { pendingSpace = used > 0; continue; }
    let word = chunk;
    if (used && used + Number(pendingSpace) + word.length > limit) flush();
    if (used && pendingSpace) { row.push({ text: ' ', role: 'plain' }); used++; }
    pendingSpace = false;
    while (word.length > limit - used) {
      if (used) { flush(); continue; }
      row.push({ text: word.slice(0, limit), role: part.role });
      word = word.slice(limit);
      used = limit;
      flush();
    }
    if (word) { row.push({ text: word, role: part.role }); used += word.length; }
  }
  flush();
  return rows.length ? rows : [[{ text: '', role: 'plain' }]];
}

export function renderHelpLines(document: HelpDocument, columns?: number): HelpLine[] {
  const usages = document.commands.map(command =>
    `pathsift ${command.name}${command.arguments ? ` ${command.arguments}` : ''}`
  );
  const width = Math.max(...usages.map(usage => usage.length));
  const specific = document.scope === 'global' ? [] : [...(document.findOptions ?? []), ...(document.whereOptions ?? [])];
  const options = [...document.scanOptions, ...specific, ...document.generalOptions];
  const optionWidth = Math.max(...options.map(option => option.syntax.length));
  const lines: HelpLine[] = [];
  const add = (text: string, role: HelpLine['role']) => lines.push({ text, role });
  const addParts = (role: HelpLine['role'], parts: HelpPart[]) =>
    lines.push({ text: parts.map(part => part.text).join(''), role, parts });
  const stacked = (labels: Array<{ syntax: string; description: string }>, width: number) =>
    columns !== undefined && labels.some(item => 2 + width + 2 + item.description.length > columns);
  const stackedLine = (role: HelpLine['role'], syntax: string, description: string) => {
    for (const row of wrapWords(syntax, (columns ?? 80) - 2)) addParts(role, [
      { text: '  ', role: 'plain' }, { text: row, role: 'code' }
    ]);
    for (const row of wrapWords(description, (columns ?? 80) - 4)) addParts('note', [
      { text: '    ' + row, role: 'plain' }
    ]);
  };
  const section = (heading: string, items: HelpOption[]) => {
    add('', 'blank');
    add(heading, 'heading');
    const stack = stacked(items, optionWidth);
    for (const option of items) {
      if (stack) stackedLine('option', option.syntax, option.description);
      else addParts('option', [
        { text: '  ', role: 'plain' },
        { text: option.syntax, role: 'code' },
        { text: ' '.repeat(optionWidth - option.syntax.length) + '  ' + option.description, role: 'plain' }
      ]);
    }
  };
  for (const row of columns === undefined ? [document.title] : wrapWords(document.title, columns)) add(row, 'title');
  add('', 'blank');
  add('Usage:', 'heading');
  const stackUsages = stacked(usages.map((syntax, index) => ({ syntax, description: document.commands[index].description })), width);
  usages.forEach((usage, index) => {
    if (stackUsages) stackedLine('usage', usage, document.commands[index].description);
    else addParts('usage', [
      { text: '  ', role: 'plain' },
      { text: usage, role: 'code' },
      { text: ' '.repeat(width - usage.length) + '  ' + document.commands[index].description, role: 'plain' }
    ]);
  });
  if (document.scanOptions.length) section(document.scope === 'command' ? 'Scan options:' : 'Directory-command options:', document.scanOptions);
  if (document.scope === 'command' && document.findOptions) section('Find filters:', document.findOptions);
  if (document.scope === 'command' && document.whereOptions) section('Where matching:', document.whereOptions);
  section('General option:', document.generalOptions);
  add('', 'blank');
  for (const note of document.notes) {
    const parts = typeof note === 'string' ? rich(note) : note;
    for (const row of columns === undefined ? [parts] : wrapParts(parts, columns)) addParts('note', row);
  }
  if (document.examples?.length) {
    add('', 'blank');
    add('Examples:', 'heading');
    for (const example of document.examples) {
      for (const row of columns === undefined ? [example] : wrapWords(example, columns - 2)) addParts('example', [
        { text: '  ', role: 'plain' }, { text: row, role: 'code' }
      ]);
    }
  }
  add('', 'blank');
  return lines;
}

export function renderHelp(document: HelpDocument): string {
  return renderHelpLines(document).map(line => line.parts
    ? line.parts.map(part => part.role === 'code' ? `\`${part.text}\`` : part.text).join('')
    : line.text).join('\n');
}
