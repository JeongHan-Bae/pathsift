import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateReleaseArtifact, validateReleaseMetadata } from './release-policy.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const preview = path.join(root, 'release-preview');
const signal = AbortSignal.timeout(30000);
const readTimedBytes = file => readFile(file, { signal });
const readTimedText = async file => (await readTimedBytes(file)).toString('utf8');

try {
  const version = process.argv[2];
  const sourceManifest = JSON.parse(await readTimedText(path.join(root, 'package.json')));
  const lock = JSON.parse(await readTimedText(path.join(root, 'package-lock.json')));
  validateReleaseMetadata(`v${version}`, sourceManifest, lock);
  const metadata = JSON.parse(await readTimedText(path.join(preview, 'pack-metadata.json')));
  const manifest = JSON.parse(await readTimedText(path.join(preview, 'package', 'package.json')));
  const readme = await readTimedText(path.join(preview, 'package', 'README.md'));
  const expectedReadme = await readTimedText(path.join(root, 'docs', 'npm-readme.md'));
  const tarball = await readTimedBytes(path.join(preview, `pathsift-${version}.tgz`));
  const integrity = 'sha512-' + createHash('sha512').update(tarball).digest('base64');
  const shasum = createHash('sha1').update(tarball).digest('hex');
  const artifact = validateReleaseArtifact(version, metadata, manifest, readme, expectedReadme, integrity, shasum);
  console.log(`Release artifact verified: ${artifact.filename} (${metadata.files.length} files)`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
