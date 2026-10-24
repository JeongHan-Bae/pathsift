import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateReleaseArtifact, validateReleaseMetadata, validateTrustedPublisherRuntime } from '../../scripts/release-policy.mjs';

const manifest = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
const lock = JSON.parse(readFileSync(new URL('../../package-lock.json', import.meta.url), 'utf8'));

test('a stable release tag matches the one package and root lock entry', () => {
  assert.deepEqual(validateReleaseMetadata('v0.1.0', manifest, lock), { tag: 'v0.1.0', version: '0.1.0' });
});

test('trusted publishing runtime meets npm and Node floors', () => {
  assert.doesNotThrow(() => validateTrustedPublisherRuntime('22.14.0', '11.5.1'));
  assert.doesNotThrow(() => validateTrustedPublisherRuntime('26.3.1', '11.16.0'));
  assert.throws(() => validateTrustedPublisherRuntime('22.13.9', '11.5.1'), /Node.js/);
  assert.throws(() => validateTrustedPublisherRuntime('26.3.1', '11.5.0'), /npm >=11.5.1/);
});

test('rejects branch names, package suffixes, prereleases, and leading zeroes', () => {
  for (const tag of ['main', '0.1.0', 'v0.1.0-cli', 'v0.1.0-alpha.1', 'v01.1.0']) {
    assert.throws(() => validateReleaseMetadata(tag, manifest, lock), /release tag/i, tag);
  }
});

test('rejects manifest, lockfile, repository, and publication metadata drift', () => {
  const changedManifest = structuredClone(manifest);
  changedManifest.version = '0.1.1';
  assert.throws(() => validateReleaseMetadata('v0.1.0', changedManifest, lock), /package version/i);

  const changedLock = structuredClone(lock);
  changedLock.packages[''].version = '0.0.1';
  assert.throws(() => validateReleaseMetadata('v0.1.0', manifest, changedLock), /package-lock/i);

  const changedRepo = structuredClone(manifest);
  changedRepo.repository.url = 'git+https://github.com/example/pathsift.git';
  assert.throws(() => validateReleaseMetadata('v0.1.0', changedRepo, lock), /repository/i);

  const changedTag = structuredClone(manifest);
  changedTag.publishConfig.tag = 'alpha';
  assert.throws(() => validateReleaseMetadata('v0.1.0', changedTag, lock), /dist-tag/i);
});

test('checks the exact publishable archive identity, README, and digest', () => {
  const published = structuredClone(manifest);
  delete published.private;
  delete published.scripts;
  delete published.devDependencies;
  const metadata = {
    name: 'pathsift', version: '0.1.0', filename: 'pathsift-0.1.0.tgz',
    integrity: 'sha512-example', shasum: 'example',
    files: ['LICENSE', 'README.md', 'package.json', 'dist/boot/cli-main.js', 'docs/architecture.md', 'docs/hash.md', 'global.ignore', 'pathsift.config.json']
      .map(path => ({ path }))
  };
  const check = (m = metadata, p = published, readme = 'usage', integrity = 'sha512-example') =>
    validateReleaseArtifact('0.1.0', m, p, readme, 'usage', integrity, 'example');
  assert.deepEqual(check(), { version: '0.1.0', filename: 'pathsift-0.1.0.tgz' });
  assert.throws(() => check(metadata, published, 'repository readme'), /README/);
  assert.throws(() => check(metadata, published, 'usage', 'sha512-changed'), /integrity/);
  assert.throws(() => check({ ...metadata, files: metadata.files.filter(file => file.path !== 'dist/boot/cli-main.js') }), /missing dist\/boot\/cli-main.js/);
  assert.throws(() => check(metadata, { ...published, private: true }), /repository-only/);
});
