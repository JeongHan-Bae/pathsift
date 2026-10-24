import ts from 'typescript';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const sourceRoot = path.join(root, 'src');
const problems = [];
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { await scan(file); continue; }
    if (!file.endsWith('.ts')) continue;
    const source = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      const specifier = statement.moduleSpecifier;
      if (!specifier || !ts.isStringLiteral(specifier)) continue;
      const value = specifier.text;
      const relative = path.relative(sourceRoot, file).split(path.sep);
      const layer = relative[0];
      const importedLayer = value.startsWith('.') ? path.relative(sourceRoot, path.resolve(path.dirname(file), value)).split(path.sep)[0] : '';
      if (value.startsWith('.') && !value.endsWith('.ts')) problems.push(`${file}: relative TypeScript import must end with .ts: ${value}`);
      if (['core', 'application'].includes(layer) && (value.startsWith('node:') || (!value.startsWith('.') && !value.startsWith('type:')))) problems.push(`${file}: ${layer} cannot import host or third-party modules: ${value}`);
      if (layer === 'core' && importedLayer && importedLayer !== 'core') problems.push(`${file}: core cannot import ${importedLayer}`);
      if (layer === 'application' && ['adapters', 'boot'].includes(importedLayer)) problems.push(`${file}: application cannot import ${importedLayer}`);
      if (layer === 'adapters' && ['application', 'boot'].includes(importedLayer)) problems.push(`${file}: adapter cannot import ${importedLayer}`);
    }
  }
}
await scan(sourceRoot);
if (problems.length) { console.error(problems.map(x => x.replace(root + path.sep, '')).join('\n')); process.exitCode = 1; }
else console.log('Layer and import checks passed.');
