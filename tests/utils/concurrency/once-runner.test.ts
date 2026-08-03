import { describe, expect, it, vi } from 'vitest';

import { OnceRunner, type Work } from '../../../src/utils/concurrency/once-runner';

describe('OnceRunner', () => {
  const createDeferredWork = (): {
    work: Work;
    resolveAll: () => void;
    rejectAll: (error: Error) => void;
    callCount: () => number;
  } => {
    const resolvers: (() => void)[] = [];
    const rejecters: ((error: Error) => void)[] = [];
    const work = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve, reject) => {
          resolvers.push(resolve);
          rejecters.push(reject);
        }),
    );
    return {
      work,
      resolveAll: () => resolvers.forEach((resolve) => resolve()),
      rejectAll: (error: Error) => rejecters.forEach((reject) => reject(error)),
      callCount: () => work.mock.calls.length,
    };
  };

  it('should share a single run with callers that arrive while it is running', async () => {
    const runner = new OnceRunner();
    const { work, resolveAll, callCount } = createDeferredWork();

    const first = runner.run(work);
    const second = runner.run(work);

    expect(callCount()).toBe(1);

    resolveAll();
    await Promise.all([first, second]);

    expect(callCount()).toBe(1);
  });

  it('should discard the work of a caller that joins a running run', async () => {
    const runner = new OnceRunner();
    const { work: runningWork, resolveAll, callCount } = createDeferredWork();
    const joiningWork = vi.fn().mockResolvedValue(undefined);

    const first = runner.run(runningWork);
    const second = runner.run(joiningWork);

    resolveAll();
    await Promise.all([first, second]);

    expect(callCount()).toBe(1);
    expect(joiningWork).not.toHaveBeenCalled();
  });

  it('should not run the work again after it has succeeded', async () => {
    const runner = new OnceRunner();
    const work = vi.fn().mockResolvedValue(undefined);

    await runner.run(work);
    await runner.run(work);

    expect(work).toHaveBeenCalledTimes(1);
  });

  it('should reject every caller waiting on a failed run', async () => {
    const runner = new OnceRunner();
    const { work, rejectAll } = createDeferredWork();
    const error = new Error('failed');

    const first = runner.run(work);
    const second = runner.run(work);

    rejectAll(error);

    await expect(first).rejects.toThrow(error);
    await expect(second).rejects.toThrow(error);
  });

  it('should run the work again after it throws synchronously', async () => {
    const runner = new OnceRunner();
    const work = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('failed');
      })
      .mockResolvedValueOnce(undefined);

    await expect(runner.run(work)).rejects.toThrow('failed');
    await runner.run(work);

    expect(work).toHaveBeenCalledTimes(2);
  });

  it('should run the work again after a failure', async () => {
    const runner = new OnceRunner();
    const work = vi
      .fn()
      .mockRejectedValueOnce(new Error('failed'))
      .mockResolvedValueOnce(undefined);

    await expect(runner.run(work)).rejects.toThrow('failed');
    await runner.run(work);

    expect(work).toHaveBeenCalledTimes(2);
  });
});
