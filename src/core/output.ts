export type CommandOutput =
  | { kind: 'text'; lines: string[] }
  | { kind: 'json'; value: { root: string; entries: Array<{ path: string; kind: string; size: number }> } };
