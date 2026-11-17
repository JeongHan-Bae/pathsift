import React from 'react';
import { once } from 'node:events';
import { writeAsyncOutput, type CommandOutput, type AsyncOutputPort, type OutputChunk, type OutputStager } from '../../core/output.ts';
import type { HelpDocument } from './cli-help.ts';
import { renderHelp, renderHelpLines, type HelpLine } from './cli-help.ts';
import { TreeLineRenderer } from './tree-line-renderer.ts';

export interface OutputTarget {
  write(text: string): unknown;
  isTTY?: boolean;
  columns?: number;
}

export function supportsInk(output: OutputTarget, term = process.env.TERM): boolean {
  return Boolean(output.isTTY && (output.columns ?? 0) >= 20 && term !== 'dumb');
}

export function plainOutput(document: CommandOutput): string {
  if (document.kind === 'stream') throw new Error('Streaming output must be printed incrementally');
  return document.kind === 'json'
    ? JSON.stringify(document.value, null, 2) + '\n'
    : document.lines.length ? document.lines.join('\n') + '\n' : '';
}

interface InkLine { text: string; role?: HelpLine['role']; parts?: HelpLine['parts'] }

async function printWithInk(lines: InkLine[], output: NodeJS.WriteStream): Promise<void> {
  const { render, Static, Text } = await import('ink');
  const renderLine = (item: unknown, index: number) => {
    const line = item as InkLine;
    const content = line.parts?.map((part, partIndex) => React.createElement(Text, {
      key: partIndex,
      color: part.role === 'code' ? 'magenta' : undefined
    }, part.text)) ?? (line.text || ' ');
    return React.createElement(Text, {
      key: index,
      color: line.role === 'title' || line.role === 'heading' ? 'cyan' : undefined,
      bold: line.role === 'title' || line.role === 'heading'
    }, content);
  };
  const props = { items: lines, children: renderLine } satisfies React.ComponentProps<typeof Static>;
  const element = React.createElement(Static, props);
  const instance = render(element, { stdout: output, patchConsole: false, exitOnCtrlC: false });
  await new Promise<void>(resolve => setImmediate(resolve));
  instance.unmount();
  await instance.waitUntilExit();
}

export async function printCommand(document: CommandOutput, output: NodeJS.WriteStream = process.stdout, stager?: OutputStager<OutputChunk>): Promise<void> {
  if (document.kind === 'stream') {
    const treeRenderer = new TreeLineRenderer();
    let streamError: Error | undefined;
    const onError = (error: Error) => { streamError = error; };
    output.on?.('error', onError);
    const port: AsyncOutputPort<OutputChunk> = {
      serialize(chunk) {
        return chunk.kind === 'tree-line' ? treeRenderer.render(chunk.line) :
          chunk.role === 'tree-root' ? treeRenderer.renderRoot(chunk.text.slice(0, -1), supportsInk(output)) : chunk.text;
      },
      async write(text) {
        if (streamError) throw streamError;
        if (output === process.stdout) {
          await new Promise<void>((resolve, reject) => output.write(text, error => error ? reject(error) : resolve()));
        } else if (!output.write(text)) await once(output, 'drain');
      }
    };
    try { await writeAsyncOutput(document.chunks, port, stager); }
    catch (error) { if ((error as NodeJS.ErrnoException)?.code !== 'EPIPE') throw error; }
    finally {
      await new Promise<void>(resolve => setImmediate(resolve));
      output.off?.('error', onError);
    }
    return;
  }
  if (document.kind === 'json' || !supportsInk(output)) {
    output.write(plainOutput(document));
    return;
  }
  if (document.lines.length) await printWithInk(document.lines.map(text => ({ text })), output);
}

export async function printHelp(document: HelpDocument, output: NodeJS.WriteStream = process.stdout): Promise<void> {
  const text = renderHelp(document);
  if (!supportsInk(output)) {
    output.write(text);
    return;
  }
  await printWithInk(renderHelpLines(document, output.columns).slice(0, -1), output);
}
