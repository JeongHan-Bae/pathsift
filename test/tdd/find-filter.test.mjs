import test from 'node:test';
import assert from 'node:assert/strict';
import { compileFindFilter, parseFindOptions } from '../../dist/core/find-filter.js';

const entry = (path, kind = 'file', size = 0, mtime = new Date('2026-11-10T00:00:00Z')) => ({ path, kind, size, mtime });
const now = Date.parse('2026-11-16T00:00:00Z');

test('find type aliases filter entries without following symlinks', () => {
  for (const [type, wanted] of [['file', 'file'], ['f', 'file'], ['dir', 'dir'], ['d', 'dir'], ['symlink', 'symlink'], ['l', 'symlink']]) {
    const filter = compileFindFilter(parseFindOptions({ type: [type] }, now));
    for (const kind of ['file', 'dir', 'symlink']) assert.equal(filter(entry('item', kind)), kind === wanted);
  }
  for (const kind of ['file', 'dir', 'symlink']) assert.equal(compileFindFilter(parseFindOptions({}, now))(entry('item', kind)), true);
  for (const type of ['text', 'binary']) {
    const filter = compileFindFilter(parseFindOptions({ type: [type] }, now));
    assert.equal(filter(entry('item', 'file')), true);
    assert.equal(filter(entry('item', 'dir')), false);
    assert.equal(filter(entry('item', 'symlink')), false);
  }
});

test('find name uses full, case-sensitive basename glob for all entry types', () => {
  const filter = compileFindFilter(parseFindOptions({ name: ['[a-z]*.ts'] }, now));
  assert.equal(filter(entry('src/config.ts')), true);
  assert.equal(filter(entry('Config.ts')), false);
  assert.equal(filter(entry('src/config.ts.old')), false);
  assert.equal(filter(entry('src/config.ts', 'dir')), true);
  assert.equal(filter(entry('src/config.ts', 'symlink')), true);
  assert.throws(() => parseFindOptions({ name: ['[bad'] }, now), /glob/i);
});

test('depth is root-relative and validates nonnegative integer bounds', () => {
  const filter = compileFindFilter(parseFindOptions({ 'min-depth': ['2'], 'max-depth': ['3'] }, now));
  assert.equal(filter(entry('a')), false);
  assert.equal(filter(entry('a/b')), true);
  assert.equal(filter(entry('a/b/c')), true);
  assert.equal(filter(entry('a/b/c/d')), false);
  assert.equal(compileFindFilter(parseFindOptions({ 'max-depth': ['0'] }, now))(entry('a')), false);
  for (const value of ['-1', '1.5', 'NaN', '1e2', '9007199254740992']) assert.throws(() => parseFindOptions({ 'max-depth': [value] }, now), /depth/i);
  assert.throws(() => parseFindOptions({ 'min-depth': ['2'], 'max-depth': ['1'] }, now), /depth/i);
});

test('size uses inclusive byte thresholds and only regular files', () => {
  const filter = compileFindFilter(parseFindOptions({ 'min-size': ['1KiB'], 'max-size': ['1MiB'] }, now));
  assert.equal(filter(entry('a', 'file', 1024)), true);
  assert.equal(filter(entry('a', 'file', 1048576)), true);
  assert.equal(filter(entry('a', 'file', 1023)), false);
  assert.equal(filter(entry('a', 'file', 1048577)), false);
  assert.equal(filter(entry('a', 'dir', 1024)), false);
  assert.equal(filter(entry('a', 'symlink', 1024)), false);
  assert.equal(compileFindFilter(parseFindOptions({ 'max-size': ['0B'] }, now))(entry('empty')), true);
  for (const [value, expected] of [['1GiB', 1024 ** 3], ['1TiB', 1024 ** 4], ['10B', 10], ['10', 10]]) assert.equal(parseFindOptions({ 'min-size': [value] }, now).minSize, expected);
  for (const value of ['-1', '1.5KiB', '2MB', '9007199254740992', '9007199254740991TiB']) assert.throws(() => parseFindOptions({ 'min-size': [value] }, now), /size/i);
  assert.throws(() => parseFindOptions({ 'min-size': ['2B'], 'max-size': ['1B'] }, now), /size/i);
});

test('time uses fixed now, UTC date, strict older/before and inclusive within', () => {
  const within = compileFindFilter(parseFindOptions({ 'modified-within': ['7d'] }, now));
  assert.equal(within(entry('a', 'file', 0, new Date(now - 7 * 86400000))), true);
  assert.equal(within(entry('a', 'file', 0, new Date(now + 1))), false);
  const older = compileFindFilter(parseFindOptions({ 'modified-older-than': ['7d'] }, now));
  assert.equal(older(entry('a', 'symlink', 0, new Date(now - 7 * 86400000))), false);
  assert.equal(older(entry('a', 'symlink', 0, new Date(now - 7 * 86400000 - 1))), true);
  const before = compileFindFilter(parseFindOptions({ 'modified-before': ['2026-11-10'] }, now));
  assert.equal(before(entry('a', 'dir', 0, new Date('2026-11-10T00:00:00Z'))), false);
  assert.equal(before(entry('a', 'dir', 0, new Date('2026-11-09T23:59:59Z'))), true);
  for (const [duration, ms] of [['1s', 1000], ['1m', 60000], ['1h', 3600000], ['1d', 86400000], ['1w', 604800000]]) assert.equal(parseFindOptions({ 'modified-within': [duration] }, now).modifiedWithinMs, ms);
  for (const value of ['0d', '-1d', '1.5d', '1x', '9007199254740991w']) assert.throws(() => parseFindOptions({ 'modified-within': [value] }, now), /duration|modified/i);
  for (const value of ['2026-02-30', '2026-13-01', '2026-1-1', 'today']) assert.throws(() => parseFindOptions({ 'modified-before': [value] }, now), /date|modified/i);
});

test('find combines conditions with AND and rejects duplicate single-value options', () => {
  const filter = compileFindFilter(parseFindOptions({ type: ['file'], name: ['*.ts'], 'min-depth': ['2'], 'min-size': ['1B'], 'modified-within': ['7d'] }, now));
  assert.equal(filter(entry('src/a.ts', 'file', 1)), true);
  for (const item of [entry('a.ts', 'file', 1), entry('src/a.js', 'file', 1), entry('src/a.ts', 'file', 0), entry('src/a.ts', 'dir', 1)]) assert.equal(filter(item), false);
  assert.throws(() => parseFindOptions({ type: ['file', 'dir'] }, now), /repeated|type/i);
});
