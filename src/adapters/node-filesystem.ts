import type { CommandPorts, WalkEntry } from '../core/ports.ts';
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { Writable } from 'node:stream';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { walk, within } from './ignore-walker.ts';
import { useMemoryBuffer } from '../core/buffer-policy.ts';

const errorCode = (error: unknown) => (error as NodeJS.ErrnoException)?.code;

async function realDestination(dest: string): Promise<string> {
  let cursor = path.dirname(dest);
  const tail = [path.basename(dest)];
  while (true) {
    try { return path.resolve(await fsp.realpath(cursor), ...tail); }
    catch (error) {
      if (errorCode(error) !== 'ENOENT') throw error;
      const parent = path.dirname(cursor);
      if (parent === cursor) throw error;
      tail.unshift(path.basename(cursor));
      cursor = parent;
    }
  }
}

async function emptyArchiveState(dest: string): Promise<{ existed: boolean }> {
  try {
    const stat = await fsp.lstat(dest);
    if (!stat.isFile()) throw new Error(`Output must be an empty regular file: ${dest}`);
    if (stat.size !== 0) throw new Error(`Output is not empty: ${dest}`);
    return { existed: true };
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return { existed: false };
    throw error;
  }
}

async function emptyDirectoryState(dest: string): Promise<{ existed: boolean }> {
  try {
    const stat = await fsp.lstat(dest);
    if (!stat.isDirectory()) throw new Error(`Destination must be an empty directory: ${dest}`);
    if ((await fsp.readdir(dest)).length) throw new Error(`Destination is not empty: ${dest}`);
    return { existed: true };
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return { existed: false };
    throw error;
  }
}

async function ensureParents(directory: string): Promise<string[]> {
  const missing: string[] = [];
  let cursor = directory;
  while (true) {
    try {
      if (!(await fsp.stat(cursor)).isDirectory()) throw new Error(`Parent is not a directory: ${cursor}`);
      break;
    } catch (error) {
      if (errorCode(error) !== 'ENOENT') throw error;
      missing.unshift(cursor);
      const parent = path.dirname(cursor);
      if (parent === cursor) throw error;
      cursor = parent;
    }
  }
  const created: string[] = [];
  try {
    for (const name of missing) { await fsp.mkdir(name); created.push(name); }
    return created;
  } catch (error) {
    await removeEmptyParents(created);
    throw error;
  }
}

async function removeEmptyParents(created: readonly string[]): Promise<void> {
  for (const name of [...created].reverse()) {
    try { await fsp.rmdir(name); }
    catch (error) { if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(errorCode(error) ?? '')) throw error; }
  }
}

async function clearDirectory(directory: string): Promise<void> {
  for (const name of await fsp.readdir(directory)) {
    await fsp.rm(path.join(directory, name), { recursive: true, force: true });
  }
}

class MemoryLimitExceeded extends Error {
  constructor() { super('In-memory archive limit exceeded'); }
}

async function readWithinLimit(file: string, remaining: number): Promise<Buffer> {
  const handle = await fsp.open(file, 'r');
  try {
    const size = (await handle.stat()).size;
    if (size > remaining) throw new MemoryLimitExceeded();
    const content = Buffer.allocUnsafe(size);
    let offset = 0;
    while (offset < content.length) {
      const { bytesRead } = await handle.read(content, offset, content.length - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    const probe = Buffer.alloc(1);
    if ((await handle.read(probe, 0, 1, offset)).bytesRead > 0) throw new MemoryLimitExceeded();
    return offset === content.length ? content : content.subarray(0, offset);
  } finally { await handle.close(); }
}

async function bufferFiles(entries: readonly WalkEntry[], limit: number): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();
  let bytes = 0;
  for (const entry of entries) {
    if (entry.kind !== 'file') continue;
    const content = await readWithinLimit(entry.fullPath, limit - bytes);
    bytes += content.length;
    files.set(entry.path, content);
  }
  return files;
}

async function writeCopyEntries(entries: readonly WalkEntry[], dest: string, buffered?: Map<string, Buffer>): Promise<number> {
  let copied = 0;
  for (const entry of entries) {
    const target = path.join(dest, ...entry.path.split('/'));
    if (entry.kind === 'dir') await fsp.mkdir(target, { recursive: true });
    else if (entry.kind === 'file') {
      await fsp.mkdir(path.dirname(target), { recursive: true });
      const data = buffered?.get(entry.path);
      if (data) await fsp.writeFile(target, data, { flag: 'wx', mode: entry.mode & 0o777 });
      else await fsp.copyFile(entry.fullPath, target, fs.constants.COPYFILE_EXCL);
      await fsp.chmod(target, entry.mode & 0o777);
      copied++;
    } else if (entry.kind === 'symlink') {
      await fsp.mkdir(path.dirname(target), { recursive: true });
      const link = await fsp.readlink(entry.fullPath);
      let type: 'junction' | 'file' = 'file';
      try { type = (await fsp.stat(entry.fullPath)).isDirectory() ? 'junction' : 'file'; }
      catch { /* broken links are preserved as file links */ }
      await fsp.symlink(link, target, type);
      copied++;
    }
  }
  return copied;
}

class MemoryArchive extends Writable {
  readonly chunks: Buffer[] = [];
  private bytes = 0;
  private readonly limit: number;
  constructor(limit: number) { super(); this.limit = limit; }
  _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    if (this.bytes + value.length > this.limit) { callback(new MemoryLimitExceeded()); return; }
    this.chunks.push(Buffer.from(value));
    this.bytes += value.length;
    callback();
  }
}

async function writeArchive(entries: readonly WalkEntry[], zipped: boolean, gzipped: boolean, output: Writable, completedEvent: 'finish' | 'close'): Promise<number> {
  const { ZipArchive, TarArchive } = await import('archiver');
  const archive = zipped ? new ZipArchive({ zlib: { level: 6 } }) :
    new TarArchive({ gzip: gzipped, gzipOptions: { level: 6 } });
  const completion = new Promise<void>((resolve, reject) => {
    output.once(completedEvent, resolve);
    output.once('error', reject);
    archive.once('error', reject);
    archive.once('warning', reject);
  });
  void completion.catch(() => {});
  archive.pipe(output);
  try {
    for (const entry of entries) {
      if (entry.kind === 'file') archive.file(entry.fullPath, { name: entry.path });
      else if (entry.kind === 'dir') archive.append(Buffer.alloc(0), { name: entry.path + '/', type: 'directory' });
      else if (entry.kind === 'symlink') archive.symlink(entry.path, await fsp.readlink(entry.fullPath), entry.mode & 0o777);
    }
    await archive.finalize();
    await completion;
    return archive.pointer();
  } catch (error) {
    archive.abort();
    output.destroy();
    if (!output.closed) await once(output, 'close');
    throw error;
  }
}

async function publishMemoryArchive(chunks: readonly Buffer[], dest: string, existed: boolean): Promise<void> {
  const createdParents = await ensureParents(path.dirname(dest));
  let opened = false;
  let writing = false;
  try {
    if (existed) await emptyArchiveState(dest);
    const handle = await fsp.open(dest, existed ? 'r+' : 'wx');
    opened = true;
    try {
      if (existed && (await handle.stat()).size !== 0) throw new Error(`Output is not empty: ${dest}`);
      writing = true;
      for (const chunk of chunks) {
        let offset = 0;
        while (offset < chunk.length) {
          const { bytesWritten } = await handle.write(chunk, offset, chunk.length - offset);
          if (bytesWritten < 1) throw new Error('Archive write made no progress');
          offset += bytesWritten;
        }
      }
    } finally { await handle.close(); }
  } catch (error) {
    if (opened && !existed) await fsp.rm(dest, { force: true });
    else if (opened && writing) await fsp.truncate(dest, 0);
    await removeEmptyParents(createdParents);
    throw error;
  }
}

export function createNodeFilesystemPorts(): CommandPorts {
  return {
    resolve: path.resolve,
    isAbsolute: path.isAbsolute,
    isSimpleFilename: (name: string) => typeof name === 'string' && Boolean(name) && name !== '.' && name !== '..' && name === path.basename(name),
    walk,
    openSource: fsp.opendir,
    digest: (text: string) => createHash('sha256').update(text, 'utf8').digest('hex'),
    async prepareDestination(source: string, dest: string, kind: 'directory' | 'file') {
      const state = kind === 'directory' ? await emptyDirectoryState(dest) : await emptyArchiveState(dest);
      const canonicalSource = await fsp.realpath(source);
      const canonicalDest = await realDestination(dest);
      if (canonicalSource === canonicalDest) throw new Error('Destination must differ from source directory');
      if (within(canonicalSource, canonicalDest)) {
        return { ...state, skipPath: path.relative(canonicalSource, canonicalDest).split(path.sep).join('/') };
      }
      return state;
    },
    async hash(file: string) {
      const hash = createHash('sha256');
      for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
      return hash.digest('hex');
    },
    async copy(entries: readonly WalkEntry[], dest: string, bufferLimitBytes: number) {
      const original = await emptyDirectoryState(dest);
      let buffered: Map<string, Buffer> | undefined;
      if (useMemoryBuffer(entries, bufferLimitBytes)) {
        try { buffered = await bufferFiles(entries, bufferLimitBytes); }
        catch (error) { if (!(error instanceof MemoryLimitExceeded)) throw error; }
      }
      const createdParents = await ensureParents(path.dirname(dest));
      let createdDestination = false;
      let writing = false;
      try {
        if (original.existed) await emptyDirectoryState(dest);
        else { await fsp.mkdir(dest); createdDestination = true; }
        writing = true;
        const directory = await fsp.opendir(dest);
        let copied: number;
        try { copied = await writeCopyEntries(entries, dest, buffered); }
        finally { await directory.close(); }
        return `Copied ${copied} files/symlinks into ${dest}`;
      } catch (error) {
        if (createdDestination) await fsp.rm(dest, { recursive: true, force: true });
        else if (writing && original.existed) await clearDirectory(dest);
        await removeEmptyParents(createdParents);
        throw error;
      }
    },
    async archive(entries: readonly WalkEntry[], dest: string, bufferLimitBytes: number) {
      const lowered = dest.toLowerCase();
      const zipped = lowered.endsWith('.zip');
      const tarred = lowered.endsWith('.tar');
      const gzipped = lowered.endsWith('.tar.gz') || lowered.endsWith('.tgz');
      if (!zipped && !tarred && !gzipped) throw new Error('Archive destination must end with .zip, .tar, .tar.gz or .tgz');
      const original = await emptyArchiveState(dest);
      if (useMemoryBuffer(entries, bufferLimitBytes)) {
        const memory = new MemoryArchive(bufferLimitBytes);
        try {
          const bytes = await writeArchive(entries, zipped, gzipped, memory, 'finish');
          await publishMemoryArchive(memory.chunks, dest, original.existed);
          return `Created ${dest} (${bytes} bytes)`;
        } catch (error) {
          if (!(error instanceof MemoryLimitExceeded)) throw error;
        }
      }
      const createdParents = await ensureParents(path.dirname(dest));
      let opened = false;
      let writing = false;
      try {
        if (original.existed) await emptyArchiveState(dest);
        const handle = await fsp.open(dest, original.existed ? 'r+' : 'wx');
        opened = true;
        if (original.existed && (await handle.stat()).size !== 0) {
          await handle.close();
          throw new Error(`Output is not empty: ${dest}`);
        }
        const output = handle.createWriteStream();
        writing = true;
        const bytes = await writeArchive(entries, zipped, gzipped, output, 'close');
        return `Created ${dest} (${bytes} bytes)`;
      } catch (error) {
        if (opened && !original.existed) await fsp.rm(dest, { force: true });
        else if (opened && writing) await fsp.truncate(dest, 0);
        await removeEmptyParents(createdParents);
        throw error;
      }
    }
  };
}
