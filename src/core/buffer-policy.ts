import type { WalkEntry } from './ports.ts';

/** Decide from the visible regular-file bytes collected by one ignore-aware walk. */
export function useMemoryBuffer(entries: readonly WalkEntry[], limitBytes: number): boolean {
  let bytes = 0;
  for (const entry of entries) {
    if (entry.kind !== 'file') continue;
    bytes += entry.size;
    if (bytes > limitBytes) return false;
  }
  return true;
}
