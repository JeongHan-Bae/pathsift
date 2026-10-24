import { SUPPORTED_HASH_VERSION, type HashVersion } from '../core/tree-digest.ts';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

export const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const configPath = path.join(packageRoot, 'pathsift.config.json');

export async function loadConfig(): Promise<{ ignoreFiles: string[]; globalIgnore: string; globalPath: string; hashVersion: HashVersion; bufferLimitBytes: number }> {
  let config: { ignoreFiles: string[]; globalIgnore: string; hashVersion: number; bufferLimitBytes: number };
  try {
    config = JSON.parse(await readFile(configPath, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      config = { ignoreFiles: ['.gitignore'], globalIgnore: 'global.ignore', hashVersion: SUPPORTED_HASH_VERSION, bufferLimitBytes: 1073741824 };
    } else throw error;
  }
  if (!Array.isArray(config.ignoreFiles) || config.ignoreFiles.length < 1 ||
      !config.ignoreFiles.every((name: string) => typeof name === 'string' && name === path.basename(name) && name !== '.' && name !== '..')) {
    throw new Error('Configuration "ignoreFiles" must be an array of simple filenames');
  }
  if (typeof config.globalIgnore !== 'string' || !config.globalIgnore.trim()) {
    throw new Error('Configuration "globalIgnore" must be a relative file path');
  }
  if (config.hashVersion !== SUPPORTED_HASH_VERSION) {
    throw new Error(`Unsupported configuration hashVersion: ${String(config.hashVersion)}; expected ${SUPPORTED_HASH_VERSION}`);
  }
  if (!Number.isSafeInteger(config.bufferLimitBytes) || config.bufferLimitBytes < 1) {
    throw new Error('Configuration "bufferLimitBytes" must be a positive safe integer');
  }
  const globalPath = path.resolve(packageRoot, config.globalIgnore);
  const rel = path.relative(packageRoot, globalPath);
  if (rel.startsWith('..' + path.sep) || rel === '..' || path.isAbsolute(rel)) {
    throw new Error('globalIgnore must stay inside the CLI package directory');
  }
  return { ...config, hashVersion: SUPPORTED_HASH_VERSION, globalPath };
}
