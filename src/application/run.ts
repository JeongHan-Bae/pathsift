import type { HashVersion } from '../core/tree-digest.ts';
import { fileDigestPayload, treeDigestPayload, type FileDigestRecord } from '../core/tree-digest.ts';
import type { CommandOutput, OutputChunk } from '../core/output.ts';
import type { CommandPorts, WalkOptions } from '../core/ports.ts';
import { requiresForce } from '../core/path-policy.ts';
import { compileFilenameMatcher, type WhereMatchMode } from '../core/where-matcher.ts';
import { compileFindFilter, type FindFilter } from '../core/find-filter.ts';
import { TreeLineStack } from '../std/tree-line-stack.ts';

const READ_COMMANDS = new Set(['tree', 'ls', 'find', 'where', 'du', 'count', 'hash', 'manifest']);

/** CLI use case. Host operations and output are supplied by the composition root. */
export async function runCommand({ cmd, args, opts, config }: { cmd: string; args: string[]; opts: { 'ignore-file'?: string[]; 'no-ignore'?: boolean; 'no-global-ignore'?: boolean; parent?: string; force?: boolean; matchMode?: WhereMatchMode; findFilter?: FindFilter }; config: { ignoreFiles: string[]; globalPath: string; hashVersion: HashVersion; bufferLimitBytes: number } }, ports: CommandPorts): Promise<CommandOutput> {
  const ignoreFiles = opts['ignore-file'] || config.ignoreFiles;
  if (!ignoreFiles.length || !ignoreFiles.every(ports.isSimpleFilename)) {
    throw new Error('--ignore-file expects a filename, not a path');
  }
  if (!READ_COMMANDS.has(cmd) && cmd !== 'cp' && cmd !== 'archive') {
    throw new Error('Unknown command: ' + cmd);
  }
  const expected = cmd === 'cp' || cmd === 'archive' || cmd === 'where' ? 2 : 1;
  if (args.length > expected) throw new Error('Unexpected extra positional arguments');
  const matcher = cmd === 'where' ? compileFilenameMatcher((args.length === 1 ? args[0] : args[1]) || '', opts.matchMode || 'exact') : undefined;
  const findMatches = cmd === 'find' && opts.findFilter ? compileFindFilter(opts.findFilter) : undefined;
  const contentKind = opts.findFilter?.contentKind;
  if ((cmd === 'cp' || cmd === 'archive') && (!args[0] || !args[1])) {
    throw new Error(cmd + ' requires source directory and destination');
  }
  for (const value of cmd === 'where' ? args.slice(0, -1) : args) {
    if (requiresForce(value, ports.isAbsolute) && !opts.force) {
      throw new Error(`Relative parent path requires --force: ${value}`);
    }
  }
  if (opts.parent !== undefined && requiresForce(opts.parent, ports.isAbsolute) && !opts.force) {
    throw new Error(`Relative parent path requires --force: ${opts.parent}`);
  }
  const source = ports.resolve((cmd === 'where' ? (args.length === 2 ? args[0] : undefined) : args[0]) || '.');
  const parentPath = opts.parent === undefined ? undefined : ports.resolve(opts.parent);
  if (parentPath !== undefined && !await ports.isWithin(parentPath, source)) {
    throw new Error(`--parent must be an ancestor of the source directory: ${parentPath}`);
  }
  const options: WalkOptions = {
    ignoreFiles, globalPath: config.globalPath, parentPath,
    ignoreEnabled: !opts['no-ignore'], globalEnabled: !opts['no-global-ignore'],
    maxDepth: cmd === 'find' ? opts.findFilter?.maxDepth : undefined,
    treeOrder: cmd === 'tree'
  };
  const entries = () => ports.walk(source, options);
  if (READ_COMMANDS.has(cmd)) {
    async function* chunks(): AsyncGenerator<OutputChunk> {
      if (cmd === 'manifest') yield { kind: 'text', text: `{"root":${JSON.stringify(source)},"entries":[` };
      let firstManifest = true;
      let treeStarted = false;
      const hashRecords: FileDigestRecord[] = [];
      const treeLines = new TreeLineStack();
      let files = 0, dirs = 0, bytes = 0;
      for await (const entry of entries()) {
        if (entry.kind === 'dir') dirs++;
        else if (entry.kind === 'file') { files++; bytes += entry.size; }
        if (cmd === 'tree' && !treeStarted) {
          yield { kind: 'text', text: source + '\n', role: 'tree-root' };
          treeStarted = true;
        }
        if (cmd === 'find' && (!findMatches || findMatches(entry)) &&
            (!contentKind || await ports.classifyFile(entry.fullPath, entry.size) === contentKind)) {
          yield { kind: 'text', text: entry.path + (entry.kind === 'dir' ? '/\n' : '\n') };
        } else if (cmd === 'where' && entry.kind === 'file' && matcher!(entry.path.slice(entry.path.lastIndexOf('/') + 1))) {
          yield { kind: 'text', text: entry.path + '\n' };
        } else if (cmd === 'ls' && !entry.path.includes('/')) {
          yield { kind: 'text', text: entry.path + (entry.kind === 'dir' ? '/\n' : '\n') };
        } else if (cmd === 'manifest') {
          yield { kind: 'text', text: (firstManifest ? '' : ',') + JSON.stringify({ path: entry.path, kind: entry.kind, size: entry.size }) };
          firstManifest = false;
        } else if (cmd === 'hash' && entry.kind === 'file') {
          const contentHash = await ports.hash(entry.fullPath);
          const filenameHash = ports.digest(entry.path);
          const fileHash = ports.digest(fileDigestPayload(filenameHash, contentHash, config.hashVersion));
          yield { kind: 'text', text: `file-sha256  ${fileHash}  ${entry.path}\n` };
          hashRecords.push({ path: entry.path, fileHash });
        } else if (cmd === 'tree') {
          yield { kind: 'tree-line', line: treeLines.line(entry) };
        }
      }
      if (cmd === 'tree' && !treeStarted) yield { kind: 'text', text: source + '\n', role: 'tree-root' };
      if (cmd === 'manifest') yield { kind: 'text', text: ']}\n' };
      if (cmd === 'hash') yield { kind: 'text', text: `tree-sha256  ${ports.digest(treeDigestPayload(hashRecords, config.hashVersion))}  ${source}\n` };
      if (cmd === 'tree') yield { kind: 'text', text: `${dirs} directories, ${files} files, ${bytes} file bytes\n` };
      if (cmd === 'count') yield { kind: 'text', text: `${dirs} directories, ${files} files, ${bytes} file bytes\n` };
      if (cmd === 'du') yield { kind: 'text', text: `${bytes}\t${source}\n` };
    }
    return { kind: 'stream', chunks: chunks() };
  }
  if (cmd === 'cp' || cmd === 'archive') {
    const dest = ports.resolve(args[1]);
    const target = await ports.prepareDestination(source, dest, cmd === 'cp' ? 'directory' : 'file');
    options.skipPath = target.skipPath;
    const sourceHandle = await ports.openSource(source);
    try {
      const selected = [];
      for await (const entry of entries()) selected.push(entry);
      const result = cmd === 'cp'
        ? await ports.copy(selected, dest, config.bufferLimitBytes)
        : await ports.archive(selected, dest, config.bufferLimitBytes);
      return { kind: 'text', lines: [result] };
    } finally { await sourceHandle.close(); }
  }
  throw new Error('Unknown command: ' + cmd);
}
