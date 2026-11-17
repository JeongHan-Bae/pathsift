import type { TreeLineOutput } from '../../core/output.ts';

/** Terminal-independent drawing of a semantic tree line. */
export class TreeLineRenderer {
  renderRoot(path: string, styled: boolean): string {
    return styled ? `\x1b[1m\x1b[36m${path}\x1b[39m\x1b[22m\n` : `${path}\n`;
  }

  render(line: TreeLineOutput): string {
    const prefix = line.ancestorsLast.map(last => last ? '    ' : '│   ').join('');
    const branch = line.lastSibling ? '└── ' : '├── ';
    const suffix = line.kind === 'dir' ? '/' : line.kind === 'symlink' ? '@' : '';
    return `${prefix}${branch}${line.name}${suffix}\n`;
  }
}
