import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export async function runCommand(command, args, { cwd, env, timeoutMs } = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new Error('runCommand requires a positive timeoutMs');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { stdout, stderr } = await exec(command, args, { cwd, env, encoding: 'utf8', signal: controller.signal, maxBuffer: 16 * 1024 * 1024 });
    return { status: 0, stdout, stderr };
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`${command} timed out after ${timeoutMs} ms`);
    if (error.code === 'ENOENT') throw error;
    return { status: typeof error.code === 'number' ? error.code : 1, stdout: String(error.stdout ?? ''), stderr: String(error.stderr ?? error.message) };
  } finally {
    clearTimeout(timer);
  }
}
