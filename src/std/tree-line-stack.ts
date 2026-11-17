import type { WalkEntry } from '../core/ports.ts';

export interface TreeLine {
  ancestorsLast: readonly boolean[];
  name: string;
  kind: WalkEntry['kind'];
  lastSibling: boolean;
}

/** Default reusable formatter for depth-first tree entries with sibling markers. */
export class TreeLineStack {
  private readonly ancestorLast: boolean[] = [];

  line(entry: Pick<WalkEntry, 'path' | 'kind' | 'lastSibling'>): TreeLine {
    const parts = entry.path.split('/');
    const depth = parts.length - 1;
    this.ancestorLast.length = depth;
    const line = { ancestorsLast: [...this.ancestorLast], name: parts[depth], kind: entry.kind, lastSibling: Boolean(entry.lastSibling) };
    this.ancestorLast[depth] = Boolean(entry.lastSibling);
    return line;
  }
}
