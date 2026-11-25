import { describe, expect, it, vi } from 'vitest';

import { InFlightTracker } from '../../../src/utils/concurrency/in-flight-tracker';
import { createPromiseWithResolvers } from '../test-utils';

describe('InFlightTracker', () => {
  it('should not be in flight initially', () => {
    expect(new InFlightTracker().isInFlight()).toBe(false);
  });

  it('should be in flight until a promise resolves', async () => {
    const tracker = new InFlightTracker();
    const promise = createPromiseWithResolvers();

    tracker.track(promise.promise);
    expect(tracker.isInFlight()).toBe(true);

    promise.resolve();
    await promise.promise;

    expect(tracker.isInFlight()).toBe(false);
  });

  it('should be in flight until a promise rejects', async () => {
    const tracker = new InFlightTracker();
    const promise = createPromiseWithResolvers();

    tracker.track(promise.promise);
    expect(tracker.isInFlight()).toBe(true);

    promise.reject(new Error('denied'));
    await expect(promise.promise).rejects.toThrow();

    expect(tracker.isInFlight()).toBe(false);
  });

  it('should call subscribers when the last promise settles', async () => {
    const tracker = new InFlightTracker();
    const callback = vi.fn();
    tracker.subscribe(callback);
    const promise = createPromiseWithResolvers();

    tracker.track(promise.promise);
    expect(callback).not.toHaveBeenCalled();

    promise.resolve();
    await promise.promise;

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should stay in flight until the last of overlapping promises settles', async () => {
    const tracker = new InFlightTracker();
    const callback = vi.fn();
    tracker.subscribe(callback);
    const first = createPromiseWithResolvers();
    const second = createPromiseWithResolvers();

    tracker.track(first.promise);
    tracker.track(second.promise);

    first.resolve();
    await first.promise;

    expect(tracker.isInFlight()).toBe(true);
    expect(callback).not.toHaveBeenCalled();

    second.resolve();
    await second.promise;

    expect(tracker.isInFlight()).toBe(false);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should not call a subscriber after it unsubscribes', async () => {
    const tracker = new InFlightTracker();
    const callback = vi.fn();
    const unsubscribe = tracker.subscribe(callback);
    const promise = createPromiseWithResolvers();

    tracker.track(promise.promise);
    unsubscribe();
    promise.resolve();
    await promise.promise;

    expect(callback).not.toHaveBeenCalled();
  });
});
