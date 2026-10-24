import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateReleaseArtifact, validateReleaseMetadata } from './release-policy.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const preview = path.join(root, 'release-preview');
const signal = AbortSignal.timeout(30000);
const readTimed = (file, encoding) => readFile(file, { encoding, signal });

try {
  const version = process.argv[2];
  const sourceManifest = JSON.parse(await readTimed(path.join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(await readTimed(path.join(root, 'package-lock.json'), 'utf8'));
  validateReleaseMetadata(`v${version}`, sourceManifest, lock);
  const metadata = JSON.parse(await readTimed(path.join(preview, 'pack-metadata.json'), 'utf8'));
  const manifest = JSON.parse(await readTimed(path.join(preview, 'package', 'package.json'), 'utf8'));
  const readme = await readTimed(path.join(preview, 'package', 'README.md'), 'utf8');
  const expectedReadme = await readTimed(path.join(root, 'docs', 'npm-readme.md'), 'utf8');
  const tarball = await readTimed(path.join(preview, `pathsift-${version}.tgz`));
  const integrity = 'sha512-' + createHash('sha512').update(tarball).digest('base64');
  const shasum = createHash('sha1').update(tarball).digest('hex');
  const artifact = validateReleaseArtifact(version, metadata, manifest, readme, expectedReadme, integrity, shasum);
  console.log(`Release artifact verified: ${artifact.filename} (${metadata.files.length} files)`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
