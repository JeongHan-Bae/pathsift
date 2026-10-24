import ts from 'typescript';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const targets = ['src', 'bin', 'scripts'];
const files = [];
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(full);
    else if (/\.(?:ts|mjs|cjs)$/.test(entry.name)) files.push(full);
  }
}
for (const target of targets) await collect(path.join(root, target));
const errors = [];
for (const file of files) {
  const source = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isPropertyAccessExpression(node) && ['platform', 'arch'].includes(node.name.text)) {
      const receiver = node.expression.getText(source);
      if (receiver === 'process' || receiver === 'os') {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
        errors.push(`${path.relative(root, file)}:${line + 1}: avoid ${receiver}.${node.name.text}; use platform-neutral Node APIs`);
      }
    }
    if (ts.isImportDeclaration(node) && ['node:os', 'os'].includes(node.moduleSpecifier.getText(source).slice(1, -1))) {
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings) && bindings.elements.some(element => ['platform', 'arch'].includes((element.propertyName ?? element.name).text))) {
        errors.push(`${path.relative(root, file)}: avoid importing platform or arch from node:os`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log(`Platform-neutral runtime check passed (${files.length} files).`);
