import { isDeepStrictEqual } from 'node:util';

const releaseTag = /^v((?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*))$/;
const registry = 'https://registry.npmjs.org/';
const repository = 'git+https://github.com/JeongHan-Bae/pathsift.git';

export function validateTrustedPublisherRuntime(nodeVersion, npmVersion) {
  const parse = value => /^(\d+)\.(\d+)\.(\d+)$/.exec(value)?.slice(1).map(Number);
  const node = parse(nodeVersion);
  const npm = parse(npmVersion);
  if (!node || node[0] < 22 || (node[0] === 22 && node[1] < 14)) {
    throw new Error(`npm trusted publishing requires Node.js >=22.14.0; found ${nodeVersion}`);
  }
  if (!npm || npm[0] < 11 || (npm[0] === 11 && (npm[1] < 5 || (npm[1] === 5 && npm[2] < 1)))) {
    throw new Error(`npm trusted publishing requires npm >=11.5.1; found ${npmVersion}`);
  }
}

export function validateReleaseMetadata(tag, manifest, lock) {
  const match = releaseTag.exec(tag ?? '');
  if (!match) throw new Error(`Invalid release tag: ${String(tag)}; expected vX.Y.Z`);
  const version = match[1];
  if (manifest?.name !== 'pathsift' || manifest.version !== version || manifest.private !== true) {
    throw new Error(`Release package version or identity differs from ${tag}`);
  }
  if (lock?.name !== 'pathsift' || lock.version !== version ||
      lock.packages?.['']?.name !== 'pathsift' || lock.packages[''].version !== version ||
      !isDeepStrictEqual(lock.packages[''].dependencies, manifest.dependencies)) {
    throw new Error(`package-lock.json is not synchronized with pathsift@${version}`);
  }
  if (manifest.repository?.url !== repository) throw new Error('Package repository must match the trusted GitHub repository');
  if (manifest.bin?.pathsift !== './dist/boot/cli-main.js') throw new Error('Release bin must point to compiled JavaScript');
  if (manifest.publishConfig?.registry !== registry || manifest.publishConfig.access !== 'public') {
    throw new Error('Release registry and access must target the public npm registry');
  }
  if (manifest.publishConfig.tag !== undefined && manifest.publishConfig.tag !== 'latest') {
    throw new Error('Stable release dist-tag must be latest');
  }
  return { tag, version };
}

export function validateReleaseArtifact(version, metadata, manifest, readme, expectedReadme, integrity, shasum) {
  if (metadata?.name !== 'pathsift' || metadata.version !== version || metadata.filename !== `pathsift-${version}.tgz`) {
    throw new Error('Packed archive identity differs from the release tag');
  }
  if (metadata.integrity !== integrity || metadata.shasum !== shasum) {
    throw new Error('Packed archive integrity differs from npm pack metadata');
  }
  if (manifest?.name !== 'pathsift' || manifest.version !== version || manifest.bin?.pathsift !== './dist/boot/cli-main.js') {
    throw new Error('Published package identity or compiled bin differs from the release tag');
  }
  if (manifest.private !== undefined || manifest.scripts !== undefined || manifest.devDependencies !== undefined) {
    throw new Error('Published package contains repository-only manifest fields');
  }
  if (manifest.publishConfig?.registry !== registry || manifest.publishConfig.access !== 'public' ||
      (manifest.publishConfig.tag !== undefined && manifest.publishConfig.tag !== 'latest')) {
    throw new Error('Published package registry, access, or dist-tag is incorrect');
  }
  if (readme !== expectedReadme) throw new Error('Published README differs from docs/npm-readme.md');
  const files = new Set(metadata.files?.map(file => file.path));
  for (const required of ['LICENSE', 'README.md', 'package.json', 'dist/boot/cli-main.js', 'docs/architecture.md', 'docs/hash.md', 'global.ignore', 'pathsift.config.json']) {
    if (!files.has(required)) throw new Error(`Packed archive is missing ${required}`);
  }
  if ([...files].some(file => file.endsWith('.ts') || file.startsWith('src/') || file.startsWith('test/'))) {
    throw new Error('Packed archive contains TypeScript source or tests');
  }
  return { version, filename: metadata.filename };
}
