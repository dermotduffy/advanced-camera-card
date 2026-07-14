import { describe, expect, it } from 'vitest';

import { LatestValueRunner } from '../../../src/utils/concurrency/latest-value-runner';

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
  reject: (reason?: unknown) => void;
}

const createDeferred = (): Deferred => {
  let resolve: () => void = () => {};
  let reject: (reason?: unknown) => void = () => {};
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

// A runner whose operation blocks on an external gate per run, so tests control
// exactly when each run completes.
const createGatedRunner = (): {
  runner: LatestValueRunner<string>;
  runs: string[];
  gates: Deferred[];
} => {
  const runs: string[] = [];
  const gates: Deferred[] = [];
  const runner = new LatestValueRunner<string>((value) => {
    runs.push(value);
    const gate = createDeferred();
    gates.push(gate);
    return gate.promise;
  });
  return { runner, runs, gates };
};

describe('LatestValueRunner', () => {
  it('should resolve the submit promise once the run completes', async () => {
    const gate = createDeferred();
    const runner = new LatestValueRunner<string>(() => gate.promise);

    let resolved = false;
    const submitted = runner.submit('a').then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    gate.resolve();
    await submitted;
    expect(resolved).toBe(true);
  });

  it('should run each value when submitted while idle', async () => {
    const runs: string[] = [];
    const runner = new LatestValueRunner<string>((value) => {
      runs.push(value);
      return Promise.resolve();
    });

    await runner.submit('a');
    await runner.submit('b');

    expect(runs).toEqual(['a', 'b']);
  });

  it('should run one value at a time and drop all but the newest while busy', async () => {
    const { runner, runs, gates } = createGatedRunner();

    const a = runner.submit('a');
    const b = runner.submit('b');
    const c = runner.submit('c');

    // Only the first run has started; the rest are pending.
    expect(runs).toEqual(['a']);

    gates[0].resolve();
    await Promise.all([a, b, c]);

    // 'b' was superseded by 'c' while 'a' ran, so it never runs.
    expect(runs).toEqual(['a', 'c']);

    gates[1].resolve();
    await Promise.resolve();
    expect(runs).toEqual(['a', 'c']);
  });

  it('should drop a pending value on clear', async () => {
    const { runner, runs, gates } = createGatedRunner();

    runner.submit('a');
    runner.submit('b');
    runner.clear();

    gates[0].resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(runs).toEqual(['a']);
  });

  it('should resolve waiters and keep draining after a run rejects', async () => {
    const { runner, runs, gates } = createGatedRunner();

    const a = runner.submit('a');
    runner.submit('b');

    gates[0].reject(new Error('boom'));
    await expect(a).resolves.toBeUndefined();

    // The rejected run does not strand the value queued behind it.
    expect(runs).toEqual(['a', 'b']);
  });
});
