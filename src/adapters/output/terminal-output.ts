import React from 'react';
import type { CommandOutput } from '../../core/output.ts';
import type { HelpDocument } from './cli-help.ts';
import { renderHelp } from './cli-help.ts';

export interface OutputTarget {
  write(text: string): unknown;
  isTTY?: boolean;
  columns?: number;
}

export function supportsInk(output: OutputTarget, term = process.env.TERM): boolean {
  return Boolean(output.isTTY && (output.columns ?? 0) >= 20 && term !== 'dumb');
}

export function plainOutput(document: CommandOutput): string {
  return document.kind === 'json'
    ? JSON.stringify(document.value, null, 2) + '\n'
    : document.lines.length ? document.lines.join('\n') + '\n' : '';
}

async function printWithInk(lines: string[], output: NodeJS.WriteStream): Promise<void> {
  const { render, Static, Text } = await import('ink');
  const element = React.createElement(Static, {
    items: lines,
    children: (line: unknown, index: number) => React.createElement(Text, {
      key: index,
      color: index === 0 ? 'cyan' : undefined
    }, String(line) || ' ')
  });
  const instance = render(element, { stdout: output, patchConsole: false, exitOnCtrlC: false });
  await new Promise<void>(resolve => setImmediate(resolve));
  instance.unmount();
  await instance.waitUntilExit();
}

export async function printCommand(document: CommandOutput, output: NodeJS.WriteStream = process.stdout): Promise<void> {
  if (document.kind === 'json' || !supportsInk(output)) {
    output.write(plainOutput(document));
    return;
  }
  if (document.lines.length) await printWithInk(document.lines, output);
}

export async function printHelp(document: HelpDocument, output: NodeJS.WriteStream = process.stdout): Promise<void> {
  const text = renderHelp(document);
  if (!supportsInk(output)) {
    output.write(text);
    return;
  }
  await printWithInk(text.trimEnd().split('\n'), output);
}
