import type { HashVersion } from '../core/tree-digest.ts';
import { fileDigestPayload, treeDigestPayload, type FileDigestRecord } from '../core/tree-digest.ts';
import type { CommandOutput } from '../core/output.ts';
import type { CommandPorts, WalkOptions } from '../core/ports.ts';
import { requiresForce } from '../core/path-policy.ts';
import { renderTree } from '../core/tree.ts';

const READ_COMMANDS = new Set(['tree', 'ls', 'find', 'du', 'count', 'hash', 'manifest']);

/** CLI use case. Host operations and output are supplied by the composition root. */
export async function runCommand({ cmd, args, opts, config }: { cmd: string; args: string[]; opts: { 'ignore-file'?: string[]; 'no-ignore'?: boolean; 'no-global-ignore'?: boolean; parent?: string; force?: boolean }; config: { ignoreFiles: string[]; globalPath: string; hashVersion: HashVersion; bufferLimitBytes: number } }, ports: CommandPorts): Promise<CommandOutput> {
  const ignoreFiles = opts['ignore-file'] || config.ignoreFiles;
  if (!ignoreFiles.length || !ignoreFiles.every(ports.isSimpleFilename)) {
    throw new Error('--ignore-file expects a filename, not a path');
  }
  if (!READ_COMMANDS.has(cmd) && cmd !== 'cp' && cmd !== 'archive') {
    throw new Error('Unknown command: ' + cmd);
  }
  const expected = cmd === 'cp' || cmd === 'archive' ? 2 : 1;
  if (args.length > expected) throw new Error('Unexpected extra positional arguments');
  if (expected === 2 && (!args[0] || !args[1])) {
    throw new Error(cmd + ' requires source directory and destination');
  }
  for (const value of args) {
    if (requiresForce(value, ports.isAbsolute) && !opts.force) {
      throw new Error(`Relative parent path requires --force: ${value}`);
    }
  }
  if (opts.parent !== undefined && requiresForce(opts.parent, ports.isAbsolute) && !opts.force) {
    throw new Error(`Relative parent path requires --force: ${opts.parent}`);
  }
  const source = ports.resolve(args[0] || '.');
  const parentPath = opts.parent === undefined ? undefined : ports.resolve(opts.parent);
  if (parentPath !== undefined && !await ports.isWithin(parentPath, source)) {
    throw new Error(`--parent must be an ancestor of the source directory: ${parentPath}`);
  }
  const options: WalkOptions = {
    ignoreFiles, globalPath: config.globalPath, parentPath,
    ignoreEnabled: !opts['no-ignore'], globalEnabled: !opts['no-global-ignore']
  };
  const entries = () => ports.walk(source, options);
  if (expected === 2) {
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
  const lines: string[] = [];
  let files = 0, dirs = 0, bytes = 0;
  const manifest = [];
  const treeEntries = [];
  const hashRecords: FileDigestRecord[] = [];
  for await (const entry of entries()) {
    if (entry.kind === 'dir') dirs++;
    else if (entry.kind === 'file') { files++; bytes += entry.size; }
    if (cmd === 'tree') treeEntries.push({ path: entry.path, kind: entry.kind });
    else if (cmd === 'find' || (cmd === 'ls' && !entry.path.includes('/'))) {
      lines.push(entry.path + (entry.kind === 'dir' ? '/' : ''));
    } else if (cmd === 'manifest') {
      manifest.push({ path: entry.path, kind: entry.kind, size: entry.size });
    } else if (cmd === 'hash' && entry.kind === 'file') {
      const contentHash = await ports.hash(entry.fullPath);
      const filenameHash = ports.digest(entry.path);
      const fileHash = ports.digest(fileDigestPayload(filenameHash, contentHash, config.hashVersion));
      lines.push(`file-sha256  ${fileHash}  ${entry.path}`);
      hashRecords.push({ path: entry.path, fileHash });
    }
  }
  if (cmd === 'tree') lines.push(...renderTree(source, treeEntries).split('\n'));
  if (cmd === 'tree' || cmd === 'count') lines.push(`${dirs} directories, ${files} files, ${bytes} file bytes`);
  if (cmd === 'du') lines.push(`${bytes}\t${source}`);
  if (cmd === 'hash') lines.push(`tree-sha256  ${ports.digest(treeDigestPayload(hashRecords, config.hashVersion))}  ${source}`);
  if (cmd === 'manifest') return { kind: 'json', value: { root: source, entries: manifest } };
  return { kind: 'text', lines };
}
