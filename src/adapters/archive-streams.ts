import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import { Readable, Transform, type Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import ZipStream from 'zip-stream';
import { pack } from 'tar-stream';
import type { WalkEntry } from '../core/ports.ts';

export type ArchiveFormat = 'zip' | 'tar' | 'tar.gz';

export async function writeArchive(entries: readonly WalkEntry[], format: ArchiveFormat, output: Writable): Promise<number> {
  const archive = format === 'zip' ? new ZipStream({ zlib: { level: 6 } }) : pack();
  let bytes = 0;
  const count = new Transform({ transform(chunk: Buffer, _encoding, callback) {
    bytes += chunk.length;
    callback(null, chunk);
  } });
  const gzip = format === 'tar.gz' ? createGzip({ level: 6 }) : undefined;
  const completion = (async () => {
    if (gzip) await pipeline(archive as Readable, gzip, count, output);
    else await pipeline(archive as Readable, count, output);
  })();
  void completion.catch(() => {});
  let activeInput: Readable | undefined;
  const failed = completion.then(() => { throw new Error('Archive output completed before entries were written'); }, error => { throw error; });
  void failed.catch(() => {});
  const guard = async <T>(work: Promise<T>): Promise<T> => Promise.race([work, failed]);
  try {
    for (const entry of entries) {
      const mode = entry.mode & 0o7777;
      if (format === 'zip') {
        const zip = archive as ZipStream;
        const type: 'directory' | 'symlink' | 'file' = entry.kind === 'dir' ? 'directory' : entry.kind === 'symlink' ? 'symlink' : 'file';
        const source = entry.kind === 'file' ? fs.createReadStream(entry.fullPath) : Buffer.alloc(0);
        if (source instanceof Readable) activeInput = source;
        const linkname = entry.kind === 'symlink' ? await guard(fsp.readlink(entry.fullPath)) : undefined;
        await guard(new Promise<void>((resolve, reject) => {
          if (source instanceof Readable) source.once('error', reject);
          zip.entry(source, { name: entry.kind === 'dir' ? `${entry.path}/` : entry.path, type, linkname, mode, date: entry.mtime }, error => error ? reject(error) : resolve());
        }));
        activeInput = undefined;
      } else {
        const tar = archive as ReturnType<typeof pack>;
        const type: 'directory' | 'symlink' | 'file' = entry.kind === 'dir' ? 'directory' : entry.kind === 'symlink' ? 'symlink' : 'file';
        const linkname = entry.kind === 'symlink' ? await guard(fsp.readlink(entry.fullPath)) : undefined;
        const header = { name: entry.kind === 'dir' ? `${entry.path}/` : entry.path, type, mode, mtime: entry.mtime, size: entry.kind === 'file' ? entry.size : 0, linkname };
        if (entry.kind === 'file') {
          const source = fs.createReadStream(entry.fullPath);
          activeInput = source;
          const sink = tar.entry(header);
          await guard(pipeline(source, sink));
          activeInput = undefined;
        } else {
          await guard(new Promise<void>((resolve, reject) => {
            tar.entry(header, Buffer.alloc(0), error => error ? reject(error) : resolve());
          }));
        }
      }
    }
    archive.finalize();
    await completion;
    return bytes;
  } catch (error) {
    activeInput?.destroy();
    archive.destroy();
    gzip?.destroy();
    count.destroy();
    output.destroy();
    await completion.catch(() => {});
    throw error;
  }
}
