export interface TreeLineOutput {
  ancestorsLast: readonly boolean[];
  name: string;
  kind: 'dir' | 'file' | 'symlink';
  lastSibling: boolean;
}

export type OutputChunk =
  | { kind: 'text'; text: string; role?: 'tree-root' }
  | { kind: 'tree-line'; line: TreeLineOutput };

export type CommandOutput =
  | { kind: 'stream'; chunks: AsyncIterable<OutputChunk> }
  | { kind: 'text'; lines: string[] }
  | { kind: 'json'; value: { root: string; entries: Array<{ path: string; kind: string; size: number }> } };

export interface AsyncOutputPort<T> {
  serialize(value: T): string;
  write(text: string): Promise<void>;
}

export interface OutputStager<T> {
  /** Values must be structured-cloneable semantic data; delivery serializes them later. */
  transfer(source: AsyncIterable<T>, deliver: (value: T) => Promise<void>): Promise<void>;
}

/** The built-in empty stager preserves direct backpressure when none is supplied. */
const emptyStager: OutputStager<never> = {
  async transfer(source, deliver) {
    for await (const value of source) await deliver(value);
  }
};

export async function writeAsyncOutput<T>(chunks: AsyncIterable<T>, port: AsyncOutputPort<T>, stager?: OutputStager<T>): Promise<void> {
  const selected: OutputStager<T> = stager ?? emptyStager;
  await selected.transfer(chunks, value => port.write(port.serialize(value)));
}
