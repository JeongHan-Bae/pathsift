import { promises as fs } from 'node:fs';
import path from 'node:path';
import { stdin, stdout } from 'node:process';
import * as readline from 'node:readline';

export function supportsTerminal(input = stdin, output = stdout) {
  return Boolean(input.isTTY && output.isTTY && typeof input.setRawMode === 'function' &&
    output.columns >= 20 && output.rows >= 6 && process.env.TERM !== 'dumb');
}

function charArray(str: string) { return Array.from(str); }
function lineLen(str: string) { return charArray(str).length; }
function printClip(str: string, max: number) {
  return charArray(str).slice(0, Math.max(0, max)).join('');
}

/** The editor uses only Node built-ins; this is a small nano-style editor,
 *  not a full Vim or Nano implementation. */
export async function editGlobalIgnore(file: string) {
  if (!supportsTerminal()) {
    throw new Error('Interactive terminal is not available. The nano command requires a TTY.');
  }
  let initial = '';
  try { initial = await fs.readFile(file, 'utf8'); }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
  const eol = initial.includes('\r\n') ? '\r\n' : '\n';
  const bom = initial.startsWith('\uFEFF') ? '\uFEFF' : '';
  let lines = initial.replace(/^\uFEFF/, '').split(/\r?\n/);
  let row = 0, col = 0, top = 0, left = 0, dirty = false, confirmExit = false;
  let status = 'Ctrl+O: Save    Ctrl+X: Exit';
  let busy = false, done = false;
  const oldRaw = stdin.isRaw;

  function ensureVisible() {
    const viewRows = Math.max(1, stdout.rows - 3);
    const usableWidth = Math.max(1, stdout.columns - 8);
    if (row < top) top = row;
    if (row >= top + viewRows) top = row - viewRows + 1;
    if (col < left) left = col;
    if (col >= left + usableWidth) left = col - usableWidth + 1;
  }
  function draw() {
    if (done) return;
    ensureVisible();
    const width = stdout.columns, height = stdout.rows;
    const viewRows = height - 3;
    const name = path.basename(file);
    let rendered = '\x1b[?25l\x1b[H\x1b[2J';
    rendered += printClip(' pathsift nano  ' + name + (dirty ? '  [Modified]' : ''), width - 1) + '\n';
    for (let i = 0; i < viewRows; i++) {
      const index = top + i;
      const prefix = index < lines.length ? String(index + 1).padStart(5) + '  ' : '    ~  ';
      const available = Math.max(1, width - prefix.length - 1);
      const content = index < lines.length ? printClip(charArray(lines[index]).slice(left).join(''), available) : '';
      rendered += prefix + content + '\x1b[K\n';
    }
    rendered += printClip(' ' + status, width - 1) + '\x1b[K\n';
    rendered += printClip(' ^O Save  ^X Exit  Arrows Move  Backspace/Delete Edit', width - 1) + '\x1b[K';
    stdout.write(rendered);
    readline.cursorTo(stdout, Math.min(width - 1, 7 + col - left), Math.min(height - 1, 1 + row - top));
    stdout.write('\x1b[?25h');
  }
  const line = () => charArray(lines[row]);
  function changeLine(arr: string[]) { lines[row] = arr.join(''); dirty = true; confirmExit = false; }
  function insert(text: string) {
    const chars = line();
    chars.splice(col, 0, ...charArray(text));
    col += lineLen(text);
    changeLine(chars);
  }
  function breakLine() {
    const arr = line();
    const remainder = arr.splice(col).join('');
    changeLine(arr);
    lines.splice(row + 1, 0, remainder);
    row++; col = 0;
  }
  function backspace() {
    if (col > 0) {
      const arr = line(); arr.splice(--col, 1); changeLine(arr);
    } else if (row > 0) {
      const prev = lines[row - 1];
      col = lineLen(prev);
      lines[row - 1] = prev + lines[row];
      lines.splice(row, 1); row--; dirty = true; confirmExit = false;
    }
  }
  function del() {
    const arr = line();
    if (col < arr.length) { arr.splice(col, 1); changeLine(arr); }
    else if (row < lines.length - 1) {
      lines[row] += lines[row + 1]; lines.splice(row + 1, 1);
      dirty = true; confirmExit = false;
    }
  }
  function moveVertical(delta: number) {
    row = Math.max(0, Math.min(lines.length - 1, row + delta));
    col = Math.min(col, lineLen(lines[row]));
  }
  async function save() {
    if (busy) return;
    busy = true;
    const tempFile = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
    try {
      await fs.mkdir(path.dirname(file), { recursive: true });
      let mode = 0o600;
      try { mode = (await fs.stat(file)).mode & 0o777; }
      catch (err) { if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err; }
      await fs.writeFile(tempFile, bom + lines.join(eol), { encoding: 'utf8', mode, flag: 'wx' });
      await fs.rename(tempFile, file);
      dirty = false;
      status = 'Saved: ' + file;
    } catch (error) {
      status = 'Save failed: ' + (error instanceof Error ? error.message : String(error));
      try { await fs.unlink(tempFile); } catch { /* ignore cleanup */ }
    } finally { busy = false; draw(); }
  }
  let resolveClosed!: () => void;
  const finished = new Promise<void>(resolve => { resolveClosed = resolve; });
  function cleanup() {
    if (done) return;
    done = true;
    stdin.off('keypress', onKey);
    stdout.off('resize', draw);
    process.off('SIGTERM', onTerm);
    stdin.setRawMode(Boolean(oldRaw));
    stdin.pause();
    stdout.write('\x1b[?25h\x1b[?1049l');
    resolveClosed();
  }
  function onTerm() { cleanup(); process.exitCode = 143; }
  function onKey(str: string | undefined, key: { ctrl?: boolean; meta?: boolean; name?: string } = {}) {
    if (done || busy) return;
    if (key.ctrl && (key.name === 'o' || key.name === 's')) { void save(); return; }
    if (key.ctrl && (key.name === 'x' || key.name === 'c')) {
      if (dirty && !confirmExit) {
        confirmExit = true;
        status = 'Unsaved changes. Ctrl+O to save, Ctrl+X again to discard.';
        draw();
      } else cleanup();
      return;
    }
    switch (key.name) {
      case 'up': moveVertical(-1); break;
      case 'down': moveVertical(1); break;
      case 'left':
        if (col > 0) col--;
        else if (row > 0) { row--; col = lineLen(lines[row]); }
        break;
      case 'right':
        if (col < lineLen(lines[row])) col++;
        else if (row < lines.length - 1) { row++; col = 0; }
        break;
      case 'home': col = 0; break;
      case 'end': col = lineLen(lines[row]); break;
      case 'pageup': moveVertical(-(stdout.rows - 3)); break;
      case 'pagedown': moveVertical(stdout.rows - 3); break;
      case 'backspace': backspace(); break;
      case 'delete': del(); break;
      case 'return': case 'enter': breakLine(); break;
      case 'tab': insert('  '); break;
      default:
        if (!key.ctrl && !key.meta && typeof str === 'string' && str && !/[\x00-\x1f\x7f]/.test(str)) insert(str);
    }
    draw();
  }
  stdout.write('\x1b[?1049h');
  readline.emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.on('keypress', onKey);
  stdout.on('resize', draw);
  process.on('SIGTERM', onTerm);
  draw();
  await finished;
}
