import { chmod } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pty from 'node-pty';

const root = fileURLToPath(new URL('../../../', import.meta.url));

export async function runNanoPty(node, bin, mode) {
  const helper = path.join(root, 'node_modules', 'node-pty', 'prebuilds', `${process.platform}-${process.arch}`, 'spawn-helper');
  await chmod(helper, 0o755).catch(error => { if (error.code !== 'ENOENT') throw error; });
  return await new Promise((resolve, reject) => {
    const terminal = pty.spawn(node, [bin, 'nano'], {
      name: 'xterm', cols: 80, rows: 24, env: { ...process.env, TERM: 'xterm' }
    });
    let transcript = '';
    let stage = 'ready';
    const timeout = setTimeout(() => {
      terminal.kill();
      reject(new Error(`nano PTY timed out in ${stage}: ${transcript.slice(-500)}`));
    }, 5000);
    terminal.onData(chunk => {
      transcript += chunk;
      if (stage === 'ready' && transcript.includes('Ctrl+O: Save')) {
        stage = mode === 'exit' ? 'closing' : 'modified';
        terminal.write(mode === 'exit' ? '\x18' : 'new.tmp');
      } else if (stage === 'modified' && transcript.includes('[Modified]')) {
        stage = mode === 'save' ? 'saving' : 'discarding';
        terminal.write(mode === 'save' ? '\x0f' : '\x18');
      } else if (stage === 'saving' && transcript.includes('Saved:')) {
        stage = 'closing';
        terminal.write('\x18');
      } else if (stage === 'discarding' && transcript.includes('Unsaved changes.')) {
        stage = 'closing';
        terminal.write('\x18');
      }
    });
    terminal.onExit(({ exitCode }) => {
      clearTimeout(timeout);
      resolve({ exit: exitCode, transcript });
    });
  });
}

export async function runCommandPty(node, bin, args) {
  const helper = path.join(root, 'node_modules', 'node-pty', 'prebuilds', `${process.platform}-${process.arch}`, 'spawn-helper');
  await chmod(helper, 0o755).catch(error => { if (error.code !== 'ENOENT') throw error; });
  return await new Promise((resolve, reject) => {
    const terminal = pty.spawn(node, [bin, ...args], {
      name: 'xterm', cols: 80, rows: 24, env: { ...process.env, TERM: 'xterm' }
    });
    let transcript = '';
    const timeout = setTimeout(() => {
      terminal.kill();
      reject(new Error(`command PTY timed out: ${transcript.slice(-500)}`));
    }, 5000);
    terminal.onData(chunk => { transcript += chunk; });
    terminal.onExit(({ exitCode }) => {
      clearTimeout(timeout);
      resolve({ exit: exitCode, transcript });
    });
  });
}
