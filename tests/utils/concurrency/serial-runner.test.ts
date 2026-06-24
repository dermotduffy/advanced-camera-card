import { describe, expect, it } from 'vitest';

import { SerialRunner } from '../../../src/utils/concurrency/serial-runner';

describe('SerialRunner', () => {
  it('should run work immediately and return its result', () => {
    const runner = new SerialRunner();

    expect(runner.run(() => 42)).toBe(42);
  });

  it('should defer work run from within work and return null for it', () => {
    const runner = new SerialRunner();
    const order: string[] = [];
    let deferredResult: number | null = -1;

    const result = runner.run(() => {
      order.push('outer-start');
      deferredResult = runner.run(() => {
        order.push('inner');
        return 2;
      });
      order.push('outer-end');
      return 1;
    });

    expect(result).toBe(1);

    // The re-entrant call returns null: its work had not run when it returned.
    expect(deferredResult).toBeNull();

    // The deferred work runs only after the outer work completes, never nested.
    expect(order).toEqual(['outer-start', 'outer-end', 'inner']);
  });

  it('should drain multiple re-entrant runs in the order enqueued', () => {
    const runner = new SerialRunner();
    const order: string[] = [];

    runner.run(() => {
      order.push('outer');
      runner.run(() => order.push('a'));
      runner.run(() => order.push('b'));
    });

    expect(order).toEqual(['outer', 'a', 'b']);
  });

  it('should drain work enqueued while draining, preserving order', () => {
    const runner = new SerialRunner();
    const order: string[] = [];

    runner.run(() => {
      order.push('outer');
      runner.run(() => {
        order.push('a');

        // Enqueued during the drain of 'a', after 'b' is already queued.
        runner.run(() => order.push('c'));
      });
      runner.run(() => order.push('b'));
    });

    expect(order).toEqual(['outer', 'a', 'b', 'c']);
  });
});
