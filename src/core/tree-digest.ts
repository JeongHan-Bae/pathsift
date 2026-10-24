export const SUPPORTED_HASH_VERSION = 1 as const;
export type HashVersion = typeof SUPPORTED_HASH_VERSION;

export interface FileDigestRecord {
  path: string;
  fileHash: string;
}

const encoder = new TextEncoder();
const sha256Hex = /^[a-f0-9]{64}$/;

function compareUtf8(left: string, right: string): number {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const count = Math.min(a.length, b.length);
  for (let i = 0; i < count; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

/** First level: combine separately hashed filename and file content. */
export function fileDigestPayload(filenameHash: string, contentHash: string, version: HashVersion): string {
  if (!sha256Hex.test(filenameHash)) throw new Error('Filename digest must be lowercase SHA-256 hex');
  if (!sha256Hex.test(contentHash)) throw new Error('Content digest must be lowercase SHA-256 hex');
  return `pathsift-file-v${version}:${filenameHash}${contentHash}`;
}

/** Second level: absorb path-ordered file hashes as one sequence. */
export function treeDigestPayload(records: readonly FileDigestRecord[], version: HashVersion): string {
  const sorted = [...records].sort((a, b) => compareUtf8(a.path, b.path));
  for (const record of sorted) {
    if (!sha256Hex.test(record.fileHash)) throw new Error('File digest must be lowercase SHA-256 hex');
  }
  return `pathsift-tree-v${version}:${sorted.length}:` + sorted.map(record => record.fileHash).join('');
}
