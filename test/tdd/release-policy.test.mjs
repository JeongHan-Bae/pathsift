import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateReleaseArtifact, validateReleaseMetadata, validateTrustedPublisherRuntime } from '../../scripts/release-policy.mjs';

/** @typedef {{ version: string, repository: { url: string }, publishConfig: { tag?: string }, private?: boolean, scripts?: object, devDependencies?: object }} ReleaseManifest */
/** @type {ReleaseManifest} */
const manifest = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
const lock = JSON.parse(readFileSync(new URL('../../package-lock.json', import.meta.url), 'utf8'));
const version = manifest.version;
const tag = `v${version}`;

test('a stable release tag matches the one package and root lock entry', () => {
  assert.deepEqual(validateReleaseMetadata(tag, manifest, lock), { tag, version });
});

test('trusted publishing runtime meets npm and Node floors', () => {
  assert.doesNotThrow(() => validateTrustedPublisherRuntime('22.14.0', '11.5.1'));
  assert.doesNotThrow(() => validateTrustedPublisherRuntime('26.3.1', '11.16.0'));
  assert.throws(() => validateTrustedPublisherRuntime('22.13.9', '11.5.1'), /Node.js/);
  assert.throws(() => validateTrustedPublisherRuntime('26.3.1', '11.5.0'), /npm >=11.5.1/);
});

test('rejects branch names, package suffixes, prereleases, and leading zeroes', () => {
  for (const badTag of ['main', version, `${tag}-cli`, `${tag}-alpha.1`, `v0${version}`]) {
    assert.throws(() => validateReleaseMetadata(badTag, manifest, lock), /release tag/i, badTag);
  }
});

test('rejects manifest, lockfile, repository, and publication metadata drift', () => {
  const changedManifest = structuredClone(manifest);
  changedManifest.version = '9.9.9';
  assert.throws(() => validateReleaseMetadata(tag, changedManifest, lock), /package version/i);

  const changedLock = structuredClone(lock);
  changedLock.packages[''].version = '0.0.1';
  assert.throws(() => validateReleaseMetadata(tag, manifest, changedLock), /package-lock/i);

  const changedRepo = structuredClone(manifest);
  changedRepo.repository.url = 'git+https://github.com/example/pathsift.git';
  assert.throws(() => validateReleaseMetadata(tag, changedRepo, lock), /repository/i);

  const changedTag = structuredClone(manifest);
  changedTag.publishConfig.tag = 'alpha';
  assert.throws(() => validateReleaseMetadata(tag, changedTag, lock), /dist-tag/i);
});

test('checks the exact publishable archive identity, README, and digest', () => {
  const published = structuredClone(manifest);
  delete published.private;
  delete published.scripts;
  delete published.devDependencies;
  const metadata = {
    name: 'pathsift', version, filename: `pathsift-${version}.tgz`,
    integrity: 'sha512-example',
    // noinspection SpellCheckingInspection -- npm's published checksum field
    shasum: 'example',
    files: ['LICENSE', 'README.md', 'package.json', 'dist/boot/cli-main.js', 'docs/architecture.md', 'docs/content-types.md', 'docs/hash.md', 'global.ignore', 'pathsift.config.json']
      .map(path => ({ path }))
  };
  const check = (m = metadata, p = published, readme = 'usage', integrity = 'sha512-example') =>
    validateReleaseArtifact(version, m, p, readme, 'usage', integrity, 'example');
  assert.deepEqual(check(), { version, filename: `pathsift-${version}.tgz` });
  assert.throws(() => check(metadata, published, 'repository readme'), /README/);
  assert.throws(() => check(metadata, published, 'usage', 'sha512-changed'), /integrity/);
  assert.throws(() => check({ ...metadata, files: metadata.files.filter(file => file.path !== 'dist/boot/cli-main.js') }), /missing dist\/boot\/cli-main.js/);
  assert.throws(() => check(metadata, { ...published, private: true }), /repository-only/);
});
