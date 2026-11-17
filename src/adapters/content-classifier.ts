import fs from 'node:fs/promises';
import type { WASMagic } from 'wasmagic';
import type { ContentKind } from '../core/content-kind.ts';

const TEXT_MIME_TYPES = [
  'text/*',
  'application/x-empty',
  'application/json', 'application/jsonl', 'application/jsonlines', 'application/x-jsonlines',
  'application/x-ndjson', 'application/json-seq',
  'application/yaml', 'application/x-yaml',
  'application/xml', 'application/javascript', 'application/toml', 'application/sql', 'image/svg+xml',
  '*+json', '*+json-seq', '*+yaml', '*+xml'
] as const;
const TEXT_ENCODINGS = ['us-ascii', 'utf-8', 'utf-16', 'utf-16le', 'utf-16be', 'utf-32', 'utf-32le', 'utf-32be'] as const;
const BINARY_MIME_TYPES = [
  'application/jsonb', 'application/x-jsonb', '*+jsonb',
  'application/zip', 'application/x-zip', 'application/x-zip-compressed', '*+zip',
  'application/gzip', 'application/x-gzip', 'application/x-bzip2', 'application/x-xz',
  'application/zstd', 'application/x-zstd', 'application/x-7z-compressed',
  'application/vnd.rar', 'application/x-rar-compressed', 'application/x-tar',
  'application/java-archive',
  'application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
  'application/vnd.ms-office', 'application/vnd.openxmlformats-officedocument.*',
  'application/vnd.ms-word.*', 'application/vnd.ms-excel.*', 'application/vnd.ms-powerpoint.*',
  'application/vnd.oasis.opendocument.*'
] as const;

function matchesMime(mime: string, pattern: string): boolean {
  if (pattern.startsWith('*+')) return mime.endsWith(pattern.slice(1));
  if (pattern.endsWith('*')) return mime.startsWith(pattern.slice(0, -1));
  return mime === pattern;
}

/** Explicit text and binary media types take priority; other types use libmagic's encoding. */
export function classifyMagicResult(result: string): ContentKind {
  const [rawMime, ...parameters] = result.toLowerCase().split(';');
  const mime = rawMime.trim();
  const charset = parameters.map(part => /^\s*charset\s*=\s*([^;\s]+)\s*$/.exec(part)?.[1]).find(Boolean);
  if (BINARY_MIME_TYPES.some(pattern => matchesMime(mime, pattern))) return 'binary';
  if (TEXT_MIME_TYPES.some(pattern => matchesMime(mime, pattern))) return 'text';
  if (charset && TEXT_ENCODINGS.some(encoding => charset === encoding)) return 'text';
  return 'binary';
}

const SAMPLE_BYTES = 64 * 1024;
let magicPromise: Promise<WASMagic> | undefined;

async function getMagic(): Promise<WASMagic> {
  if (!magicPromise) {
    magicPromise = import('wasmagic').then(({ WASMagic, WASMagicFlags }) =>
      WASMagic.create({ flags: WASMagicFlags.MIME_TYPE | WASMagicFlags.MIME_ENCODING }));
    void magicPromise.catch(() => { magicPromise = undefined; });
  }
  return magicPromise;
}

async function readAt(handle: fs.FileHandle, length: number, position: number): Promise<Buffer> {
  const buffer = Buffer.alloc(length);
  let offset = 0;
  while (offset < length) {
    const { bytesRead } = await handle.read(buffer, offset, length - offset, position + offset);
    if (bytesRead === 0) break;
    offset += bytesRead;
  }
  return offset === length ? buffer : buffer.subarray(0, offset);
}

/** One bounded head sample and, for large files, one bounded tail sample. */
export async function classifyFile(file: string, size: number): Promise<ContentKind> {
  const handle = await fs.open(file, 'r');
  let head: Buffer;
  let tail: Buffer | undefined;
  try {
    if (size <= SAMPLE_BYTES * 2) head = await readAt(handle, size, 0);
    else {
      head = await readAt(handle, SAMPLE_BYTES, 0);
      tail = await readAt(handle, SAMPLE_BYTES, size - SAMPLE_BYTES);
    }
  } finally { await handle.close(); }
  const magic = await getMagic();
  if (classifyMagicResult(magic.detect(head)) === 'binary') return 'binary';
  return tail && classifyMagicResult(magic.detect(tail)) === 'binary' ? 'binary' : 'text';
}
