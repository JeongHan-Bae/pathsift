export type TreeEntry = { path: string; kind: 'dir' | 'file' | 'symlink' };
export type TreeNode = { name: string; kind: TreeEntry['kind']; children: TreeNode[] };
type MutableNode = { name: string; kind: TreeEntry['kind']; children: Map<string, MutableNode> };

function ordered(children: Map<string, MutableNode>): TreeNode[] {
  return [...children.values()]
    .sort((left, right) => {
      const byKind = Number(right.kind === 'dir') - Number(left.kind === 'dir');
      return byKind || left.name.localeCompare(right.name, 'en');
    })
    .map(node => ({ name: node.name, kind: node.kind, children: ordered(node.children) }));
}

/** Build a presentation tree independently of filesystem traversal order. */
export function buildTree(entries: ReadonlyArray<TreeEntry>): TreeNode[] {
  const root = new Map<string, MutableNode>();
  for (const entry of entries) {
    const parts = entry.path.split('/');
    let siblings = root;
    for (let depth = 0; depth < parts.length; depth++) {
      const name = parts[depth];
      let node = siblings.get(name);
      if (!node) {
        node = { name, kind: depth === parts.length - 1 ? entry.kind : 'dir', children: new Map() };
        siblings.set(name, node);
      }
      if (depth === parts.length - 1) node.kind = entry.kind;
      siblings = node.children;
    }
  }
  return ordered(root);
}

/** Render directories first, then files and symlinks, at every level. */
export function renderTree(root: string, entries: ReadonlyArray<TreeEntry>): string {
  const lines = [root];
  function append(nodes: readonly TreeNode[], prefix: string): void {
    nodes.forEach((node, index) => {
      const last = index === nodes.length - 1;
      const suffix = node.kind === 'dir' ? '/' : node.kind === 'symlink' ? '@' : '';
      lines.push(`${prefix}${last ? '└── ' : '├── '}${node.name}${suffix}`);
      append(node.children, prefix + (last ? '    ' : '│   '));
    });
  }
  append(buildTree(entries), '');
  return lines.join('\n');
}
