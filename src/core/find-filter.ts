import type { WalkEntry } from './ports.ts';
import type { ContentKind } from './content-kind.ts';
import { compileFilenameMatcher } from './where-matcher.ts';

export type FindOptionName = 'type' | 'name' | 'min-depth' | 'max-depth' | 'min-size' | 'max-size' | 'modified-within' | 'modified-older-than' | 'modified-before';
export type RawFindOptions = Partial<Record<FindOptionName, string[]>>;

export interface FindFilter {
  type?: WalkEntry['kind'];
  contentKind?: ContentKind;
  name?: (basename: string) => boolean;
  minDepth?: number;
  maxDepth?: number;
  minSize?: number;
  maxSize?: number;
  modifiedWithinMs?: number;
  modifiedOlderThanMs?: number;
  modifiedBefore?: number;
  now: number;
}

const valueOf = (options: RawFindOptions, key: FindOptionName): string | undefined => {
  const values = options[key];
  if (values && values.length !== 1) throw new Error(`--${key} cannot be repeated`);
  return values?.[0];
};

function nonnegativeInteger(value: string | undefined, label: string): number | undefined {
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value)) throw new Error(`Invalid ${label}: ${value}`);
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error(`Invalid ${label}: ${value}`);
  return number;
}

function size(value: string | undefined, label: string): number | undefined {
  if (value === undefined) return undefined;
  const parts = /^(\d+)(B|KiB|MiB|GiB|TiB)?$/.exec(value);
  if (!parts) throw new Error(`Invalid ${label}: ${value}`);
  const exponent = { B: 0, KiB: 1, MiB: 2, GiB: 3, TiB: 4 }[parts[2] as 'B' | 'KiB' | 'MiB' | 'GiB' | 'TiB'] ?? 0;
  const result = Number(parts[1]) * 1024 ** exponent;
  if (!Number.isSafeInteger(result)) throw new Error(`Invalid ${label}: ${value}`);
  return result;
}

function duration(value: string | undefined, label: string): number | undefined {
  if (value === undefined) return undefined;
  const parts = /^([1-9]\d*)([smhdw])$/.exec(value);
  if (!parts) throw new Error(`Invalid ${label} duration: ${value}`);
  const factor = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 }[parts[2] as 's' | 'm' | 'h' | 'd' | 'w'];
  const result = Number(parts[1]) * factor;
  if (!Number.isSafeInteger(result)) throw new Error(`Invalid ${label} duration: ${value}`);
  return result;
}

function utcDate(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid --modified-before date: ${value}`);
  const parsed = Date.parse(value + 'T00:00:00.000Z');
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) throw new Error(`Invalid --modified-before date: ${value}`);
  return parsed;
}

export function parseFindOptions(options: RawFindOptions, now: number): FindFilter {
  const rawType = valueOf(options, 'type');
  const type = rawType === undefined ? undefined : ({ file: 'file', f: 'file', dir: 'dir', d: 'dir', symlink: 'symlink', l: 'symlink', text: 'file', binary: 'file' } as Record<string, WalkEntry['kind']>)[rawType];
  if (rawType !== undefined && !type) throw new Error(`Invalid --type: ${rawType}`);
  const rawName = valueOf(options, 'name');
  if (rawName !== undefined && (!rawName || rawName.includes('/') || rawName.includes('\\'))) throw new Error('--name expects a nonempty basename Glob without directory separators');
  const minDepth = nonnegativeInteger(valueOf(options, 'min-depth'), '--min-depth');
  const maxDepth = nonnegativeInteger(valueOf(options, 'max-depth'), '--max-depth');
  const minSize = size(valueOf(options, 'min-size'), '--min-size');
  const maxSize = size(valueOf(options, 'max-size'), '--max-size');
  if (minDepth !== undefined && maxDepth !== undefined && minDepth > maxDepth) throw new Error('--min-depth exceeds --max-depth');
  if (minSize !== undefined && maxSize !== undefined && minSize > maxSize) throw new Error('--min-size exceeds --max-size');
  return {
    type,
    contentKind: rawType === 'text' || rawType === 'binary' ? rawType : undefined,
    name: rawName === undefined ? undefined : compileFilenameMatcher(rawName, 'glob'),
    minDepth, maxDepth, minSize, maxSize,
    modifiedWithinMs: duration(valueOf(options, 'modified-within'), '--modified-within'),
    modifiedOlderThanMs: duration(valueOf(options, 'modified-older-than'), '--modified-older-than'),
    modifiedBefore: utcDate(valueOf(options, 'modified-before')),
    now
  };
}

export function compileFindFilter(filter: FindFilter): (entry: WalkEntry) => boolean {
  return entry => {
    const depth = entry.path.split('/').length;
    if (filter.minDepth !== undefined && depth < filter.minDepth) return false;
    if (filter.maxDepth !== undefined && depth > filter.maxDepth) return false;
    if (filter.type && entry.kind !== filter.type) return false;
    if (filter.name && !filter.name(entry.path.slice(entry.path.lastIndexOf('/') + 1))) return false;
    if (filter.minSize !== undefined || filter.maxSize !== undefined) {
      if (entry.kind !== 'file') return false;
      if (filter.minSize !== undefined && entry.size < filter.minSize) return false;
      if (filter.maxSize !== undefined && entry.size > filter.maxSize) return false;
    }
    if (filter.modifiedWithinMs !== undefined || filter.modifiedOlderThanMs !== undefined || filter.modifiedBefore !== undefined) {
      const mtime = entry.mtime.getTime();
      if (filter.modifiedWithinMs !== undefined && !(mtime >= filter.now - filter.modifiedWithinMs && mtime <= filter.now)) return false;
      if (filter.modifiedOlderThanMs !== undefined && !(mtime < filter.now - filter.modifiedOlderThanMs)) return false;
      if (filter.modifiedBefore !== undefined && !(mtime < filter.modifiedBefore)) return false;
    }
    return true;
  };
}
