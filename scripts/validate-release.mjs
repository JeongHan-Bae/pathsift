import { appendFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateReleaseMetadata, validateTrustedPublisherRuntime } from './release-policy.mjs';
import { runCommand } from './run-command.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const tag = process.argv[2] ?? process.env.RELEASE_TAG;

try {
  const npmVersion = await runCommand('npm', ['--version'], { cwd: root, timeoutMs: 10000 });
  if (npmVersion.status !== 0) throw new Error(`Could not read npm CLI version: ${npmVersion.stderr.trim()}`);
  validateTrustedPublisherRuntime(process.versions.node, npmVersion.stdout.trim());
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
  const release = validateReleaseMetadata(tag, manifest, lock);
  const [tagged, head] = await Promise.all([
    runCommand('git', ['rev-parse', '--verify', `refs/tags/${release.tag}^{commit}`], { cwd: root, timeoutMs: 10000 }),
    runCommand('git', ['rev-parse', 'HEAD'], { cwd: root, timeoutMs: 10000 })
  ]);
  if (tagged.status !== 0 || head.status !== 0 || tagged.stdout.trim() !== head.stdout.trim()) {
    throw new Error(`Release tag ${release.tag} must exist and point at the checked-out commit`);
  }
  const lookup = await runCommand('npm', ['view', `pathsift@${release.version}`, 'version', '--json', '--registry=https://registry.npmjs.org/'], { cwd: root, timeoutMs: 30000 });
  if (lookup.status === 0) throw new Error(`pathsift@${release.version} is already published`);
  if (!/E404/.test(lookup.stderr)) throw new Error(`Could not inspect npm version state: ${lookup.stderr.trim()}`);
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `tag=${release.tag}\nversion=${release.version}\n`);
  }
  console.log(`Release ${release.tag} is valid; pathsift@${release.version} is available for latest`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
