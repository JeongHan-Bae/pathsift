import test from 'node:test';
import assert from 'node:assert/strict';
import { runCommand } from '../../scripts/run-command.mjs';

test('async command runner returns output and exit status', async () => {
  const result = await runCommand(process.execPath, ['-e', 'process.stdout.write("ok")'], { timeoutMs: 10000 });
  assert.deepEqual(result, { status: 0, stdout: 'ok', stderr: '' });
  const failed = await runCommand(process.execPath, ['-e', 'process.exit(7)'], { timeoutMs: 10000 });
  assert.equal(failed.status, 7);
});

test('async command runner stops a command at its deadline', async () => {
  await assert.rejects(runCommand(process.execPath, ['-e', 'setTimeout(() => {}, 10000)'], { timeoutMs: 50 }), /timed out after 50 ms/);
});
