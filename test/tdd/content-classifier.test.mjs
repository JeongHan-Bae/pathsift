import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyMagicResult } from '../../dist/adapters/content-classifier.js';

test('charset separates embedded PDF signatures from binary PDF data', () => {
  assert.equal(classifyMagicResult('application/pdf; charset=us-ascii'), 'text');
  assert.equal(classifyMagicResult('application/pdf; charset=binary'), 'binary');
  assert.equal(classifyMagicResult('application/pdf; charset=iso-8859-1'), 'binary');
});

test('empty, Unicode text, and binary encodings map consistently', () => {
  for (const result of ['application/x-empty; charset=binary', 'text/plain; charset=utf-8', 'text/plain; charset=utf-16le', 'application/octet-stream; charset=us-ascii']) {
    assert.equal(classifyMagicResult(result), 'text', result);
  }
  for (const result of ['text/plain; charset=unknown-8bit', 'text/x-affix; charset=unknown-8bit', 'text/plain; charset=binary']) {
    assert.equal(classifyMagicResult(result), 'text', result);
  }
  for (const result of ['image/png; charset=binary', 'application/zip; charset=binary', 'application/octet-stream; charset=unknown-8bit']) {
    assert.equal(classifyMagicResult(result), 'binary', result);
  }
});

test('JSON media types are text, JSONB is binary, and other signed media use charset', () => {
  for (const result of [
    'application/json; charset=binary', 'application/x-ndjson; charset=unknown-8bit',
    'application/jsonl; charset=binary', 'application/json-seq; charset=binary',
    'application/vnd.example+json; charset=binary',
    'application/yaml; charset=binary', 'application/vnd.example+yaml; charset=unknown-8bit',
    'application/xml; charset=binary', 'image/svg+xml; charset=binary',
    'application/javascript; charset=binary', 'application/toml; charset=binary',
    'application/sql; charset=binary'
  ]) assert.equal(classifyMagicResult(result), 'text', result);
  for (const result of [
    'application/jsonb; charset=us-ascii', 'application/x-jsonb; charset=utf-8',
    'application/vnd.example+jsonb; charset=us-ascii'
  ]) assert.equal(classifyMagicResult(result), 'binary', result);
  assert.equal(classifyMagicResult('application/pdf; charset=utf-8'), 'text');
  assert.equal(classifyMagicResult('application/pdf; charset=binary'), 'binary');
});

test('compressed and Office MIME types override textual charsets without blacklisting PDF', () => {
  for (const mime of [
    'application/zip', 'application/gzip', 'application/x-7z-compressed', 'application/x-tar',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel.sheet.macroenabled.12', 'application/msword'
  ]) assert.equal(classifyMagicResult(`${mime}; charset=us-ascii`), 'binary', mime);
  assert.equal(classifyMagicResult('application/pdf; charset=us-ascii'), 'text');
});
