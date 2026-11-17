import test from 'node:test';
import assert from 'node:assert/strict';
import { compileFilenameMatcher } from '../../dist/core/where-matcher.js';

test('exact compares the entire case-sensitive filename and treats metacharacters literally', () => {
  const match = compileFilenameMatcher('config.ts', 'exact');
  for (const name of ['config.json', 'Config.ts', 'my-config.ts', '']) assert.equal(match(name), false);
  assert.equal(match('config.ts'), true);
  assert.equal(compileFilenameMatcher('*[?]', 'exact')('*[?]'), true);
  assert.equal(compileFilenameMatcher('.é.txt', 'exact')('.é.txt'), true);
});

test('contains uses a contiguous literal substring without case folding', () => {
  const match = compileFilenameMatcher('config', 'contains');
  for (const name of ['config.ts', 'my-config.yaml', 'configuration', 'config']) assert.equal(match(name), true);
  for (const name of ['Config.ts', 'cfg.ts', 'con-fig']) assert.equal(match(name), false);
  assert.equal(compileFilenameMatcher('[a]', 'contains')('x[a].txt'), true);
  assert.equal(compileFilenameMatcher('é', 'contains')('.é.txt'), true);
});

test('glob matches a full basename with stars, questions, sets, ranges and hidden files', () => {
  const cases = [
    ['a*.txt', 'a.txt', true], ['a*.txt', 'apple.txt', true], ['a*.txt', 'data.txt', false],
    ['*a*?.txt', 'a.txt', false], ['*a*?.txt', 'data.txt', true],
    ['?.txt', 'a.txt', true], ['?.txt', 'ab.txt', false],
    ['[abc].txt', 'b.txt', true], ['[abc].txt', 'd.txt', false],
    ['[a-z].txt', 'm.txt', true], ['[a-z].txt', 'M.txt', false],
    ['*.txt', '.hidden.txt', true], ['*.txt', 'a.txt.bak', false],
    ['*.txt', 'dir/a.txt', false]
  ];
  for (const [query, name, expected] of cases) assert.equal(compileFilenameMatcher(query, 'glob')(name), expected, `${query} / ${name}`);
});

test('invalid queries fail before traversal', () => {
  for (const mode of ['exact', 'contains', 'glob']) {
    for (const query of ['', 'src/config.ts', 'src\\config.ts']) assert.throws(() => compileFilenameMatcher(query, mode), /query|separator/i);
  }
  for (const query of ['[', '[]', '[z-a]', '[abc']) assert.throws(() => compileFilenameMatcher(query, 'glob'), /glob/i);
});
