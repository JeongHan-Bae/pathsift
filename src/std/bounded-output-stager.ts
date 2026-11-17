import type { OutputStager } from '../core/output.ts';

export const DEFAULT_OUTPUT_STAGE_CAPACITY = 1024;

/** Keeps semantic values ahead of a temporarily blocked output, up to capacity. */
export class BoundedOutputStager<T> implements OutputStager<T> {
  private readonly capacity: number;

  constructor(capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error('Output staging capacity must be a positive integer');
    this.capacity = capacity;
  }

  async transfer(source: AsyncIterable<T>, deliver: (value: T) => Promise<void>): Promise<void> {
    const iterator = source[Symbol.asyncIterator]();
    const queue: T[] = [];
    let finished = false;
    let cancelled = false;
    let sourceFailed = false;
    let sourceError: unknown;
    let dataWaiter: (() => void) | undefined;
    let spaceWaiter: (() => void) | undefined;
    const wakeData = () => { dataWaiter?.(); dataWaiter = undefined; };
    const wakeSpace = () => { spaceWaiter?.(); spaceWaiter = undefined; };

    const producer = (async () => {
      try {
        while (!cancelled) {
          while (queue.length >= this.capacity && !cancelled) await new Promise<void>(resolve => { spaceWaiter = resolve; });
          if (cancelled) break;
          const next = await iterator.next();
          if (next.done) break;
          queue.push(structuredClone(next.value));
          wakeData();
        }
      } catch (error) { sourceFailed = true; sourceError = error; }
      finally {
        finished = true;
        wakeData();
        if (cancelled) {
          try { await iterator.return?.(); } catch { /* delivery error takes precedence */ }
        }
      }
    })();

    try {
      while (queue.length || !finished) {
        if (!queue.length) {
          await new Promise<void>(resolve => { dataWaiter = resolve; });
          continue;
        }
        const value = queue.shift()!;
        wakeSpace();
        await deliver(value);
      }
    } catch (error) {
      cancelled = true;
      wakeSpace();
      wakeData();
      await producer;
      throw error;
    }
    await producer;
    if (sourceFailed) throw sourceError;
  }
}
