import type { WhereMatchMode } from '../core/where-matcher.ts';

export function selectWhereMode(options: { exact?: boolean[]; contains?: boolean[]; glob?: boolean[] }): WhereMatchMode {
  const modes = (['exact', 'contains', 'glob'] as const).filter(mode => options[mode] !== undefined);
  if (modes.length > 1) throw new Error('where matching modes are mutually exclusive');
  return modes[0] || 'exact';
}
