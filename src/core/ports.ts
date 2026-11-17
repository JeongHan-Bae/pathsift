import type { ContentKind } from './content-kind.ts';

export interface WalkEntry {
  path: string;
  fullPath: string;
  kind: 'dir' | 'file' | 'symlink';
  size: number;
  mode: number;
  mtime: Date;
  lastSibling?: boolean;
}

export interface WalkOptions {
  ignoreFiles: string[];
  globalPath?: string;
  parentPath?: string;
  ignoreEnabled: boolean;
  globalEnabled: boolean;
  skipPath?: string;
  maxDepth?: number;
  treeOrder?: boolean;
}

export interface CommandPorts {
  resolve(value: string): string;
  isAbsolute(value: string): boolean;
  isWithin(ancestor: string, candidate: string): Promise<boolean>;
  isSimpleFilename(value: string): boolean;
  walk(root: string, options: WalkOptions): AsyncIterable<WalkEntry>;
  openSource(root: string): Promise<{ close(): Promise<void> }>;
  prepareDestination(source: string, destination: string, kind: 'directory' | 'file'): Promise<{ existed: boolean; skipPath?: string }>;
  hash(file: string): Promise<string>;
  classifyFile(file: string, size: number): Promise<ContentKind>;
  digest(text: string): string;
  copy(entries: readonly WalkEntry[], destination: string, bufferLimitBytes: number): Promise<string>;
  archive(entries: readonly WalkEntry[], destination: string, bufferLimitBytes: number): Promise<string>;
}
