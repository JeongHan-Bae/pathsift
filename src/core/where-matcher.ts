export type WhereMatchMode = 'exact' | 'contains' | 'glob';

function escapeRegex(value: string): string {
  const special = new Set(['\\', '^', '$', '.', '*', '+', '?', '(', ')', '[', ']', '{', '}', '|']);
  return [...value].map(char => special.has(char) ? `\\${char}` : char).join('');
}

function compileGlob(query: string): RegExp {
  let pattern = '^';
  for (let index = 0; index < query.length; index++) {
    const char = query[index];
    if (char === '*') pattern += '[\\s\\S]*';
    else if (char === '?') pattern += '[\\s\\S]';
    else if (char === '[') {
      const end = query.indexOf(']', index + 1);
      if (end < 0 || end === index + 1) throw new Error(`Invalid glob pattern: ${query}`);
      const members = query.slice(index + 1, end);
      if (members.includes('[') || members.includes('\\') || members.startsWith('^')) throw new Error(`Invalid glob pattern: ${query}`);
      try { new RegExp(`[${members}]`); } catch { throw new Error(`Invalid glob pattern: ${query}`); }
      pattern += `[${members}]`;
      index = end;
    } else pattern += escapeRegex(char);
  }
  return new RegExp(pattern + '$', 'u');
}

export function compileFilenameMatcher(query: string, mode: WhereMatchMode): (filename: string) => boolean {
  if (!query) throw new Error('where requires a nonempty filename query');
  if (query.includes('/') || query.includes('\\')) throw new Error('where query must be a filename without directory separators');
  if (mode === 'exact') return filename => filename === query;
  if (mode === 'contains') return filename => filename.includes(query);
  const pattern = compileGlob(query);
  return filename => !filename.includes('/') && !filename.includes('\\') && pattern.test(filename);
}
