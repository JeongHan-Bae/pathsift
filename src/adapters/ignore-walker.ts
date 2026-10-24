import type { WalkEntry, WalkOptions } from '../core/ports.ts';
import type { Ignore } from 'ignore';
import fs from 'node:fs/promises';
import path from 'node:path';

const toPosix = (value: string) => value.split(path.sep).join('/');
const isEnoent = (e: unknown) => (e as NodeJS.ErrnoException)?.code === 'ENOENT';

async function readOptional(file: string) {
  try { return await fs.readFile(file, 'utf8'); }
  catch (e) { if (isEnoent(e)) return ''; throw e; }
}

type Scope = { base: string; text: string; matcher: Ignore };

function scope(root: string, text: string, createIgnore: () => Ignore): Scope {
  return { base: root, text, matcher: createIgnore().add(text) };
}

function relativeRulePath(context: Scope, absPath: string, isDir: boolean) {
  const rel = toPosix(path.relative(context.base, absPath));
  return rel + (isDir ? '/' : '');
}

/** A scope is anchored to the directory containing its ignore file.
 *  Higher-level scopes are evaluated before deeper ones.
 */
function allowed(absPath: string, isDir: boolean, scopes: Scope[]) {
  let ignored = false;
  const matchingIgnoredScopes: { scope: Scope; rulePath: string }[] = [];
  for (const s of scopes) {
    const rulePath = relativeRulePath(s, absPath, isDir);
    if (!rulePath || rulePath === '/') continue;
    const result = s.matcher.test(rulePath);
    if (result.ignored) {
      ignored = true;
      if (isDir) matchingIgnoredScopes.push({ scope: s, rulePath });
    } else if (result.unignored) {
      ignored = false;
    }
  }
  // A later scope's '!folder/' can override an earlier scope's 'folder/'.
  // Ensure that the older matcher no longer treats *all* descendants as
  // inherited ignores. Its file-specific rules remain active.
  return { accepted: !ignored, overridden: isDir && !ignored ? matchingIgnoredScopes : [] };
}

export async function* walk(root: string, {
  ignoreFiles = ['.gitignore'], globalPath, skipPath,
  ignoreEnabled = true, globalEnabled = true
}: Partial<WalkOptions> = {}): AsyncGenerator<WalkEntry> {
  root = path.resolve(root);
  const stat = await fs.lstat(root);
  if (!stat.isDirectory()) throw new Error('Source must be a directory: ' + root);
  const createIgnore = ignoreEnabled ? (await import('ignore')).default : null;
  const scopes: Scope[] = [];
  if (ignoreEnabled && globalEnabled && globalPath) {
    scopes.push(scope(root, await readOptional(globalPath), createIgnore!));
  }
  async function* descend(dir: string, inheritedScopes: Scope[] = scopes): AsyncGenerator<WalkEntry> {
    const attached = [];
    if (ignoreEnabled) {
      for (const name of ignoreFiles) {
        const contents = await readOptional(path.join(dir, name));
        if (contents) attached.push(scope(dir, contents, createIgnore!));
      }
    }
    const currentScopes = inheritedScopes.concat(attached);
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    dirents.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const entry of dirents) {
      const fullPath = path.join(dir, entry.name);
      const rel = toPosix(path.relative(root, fullPath));
      if (skipPath === rel) continue;
      const isDir = entry.isDirectory(); // symlinks are not followed
      const decision = ignoreEnabled ? allowed(fullPath, isDir, currentScopes) : { accepted: true, overridden: [] };
      if (!decision.accepted) continue;
      const kind: WalkEntry['kind'] | 'other' = isDir ? 'dir' : entry.isSymbolicLink() ? 'symlink' : entry.isFile() ? 'file' : 'other';
      if (kind === 'other') continue;
      const metadata = await fs.lstat(fullPath);
      yield { path: rel, fullPath, kind, size: metadata.size, mode: metadata.mode, mtime: metadata.mtime };
      if (isDir) {
        const childScopes = currentScopes.map(s => {
          const override = decision.overridden.find(item => item.scope === s);
          return override ? scope(s.base, s.text + '\n!' + override.rulePath, createIgnore!) : s;
        });
        yield* descend(fullPath, childScopes);
      }
    }
  }
  yield* descend(root);
}

export const within = (ancestor: string, candidate: string): boolean => {
  const rel = path.relative(path.resolve(ancestor), path.resolve(candidate));
  return rel === '' || (rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel));
};
