import { execFile } from 'node:child_process';

/** @returns {Promise<{ stdout: string, stderr: string }>} */
function exec(command, args, options) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) reject(Object.assign(error, { stdout: String(stdout), stderr: String(stderr) }));
      else resolve({ stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

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
