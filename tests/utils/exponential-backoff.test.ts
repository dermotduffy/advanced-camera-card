import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExponentialBackoff } from '../../src/utils/exponential-backoff';

describe('ExponentialBackoff', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should start at attempts=0', () => {
    const backoff = new ExponentialBackoff({ baseSeconds: 1, maxSeconds: 60 });
    expect(backoff.getAttempts()).toBe(0);
  });

  it('should compute exponential delays with the configured base', () => {
    // Pin jitter to 1.0 so we can read the raw exponential values.
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const backoff = new ExponentialBackoff({
      baseSeconds: 1,
      maxSeconds: 60,
      jitterMin: 1,
      jitterMax: 1,
    });

    expect(backoff.next()).toBe(1);
    expect(backoff.next()).toBe(2);
    expect(backoff.next()).toBe(4);
    expect(backoff.next()).toBe(8);
    expect(backoff.next()).toBe(16);
  });

  it('should cap delays at maxSeconds', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const backoff = new ExponentialBackoff({
      baseSeconds: 1,
      maxSeconds: 10,
      jitterMin: 1,
      jitterMax: 1,
    });

    backoff.next();
    backoff.next();
    backoff.next();
    backoff.next();

    expect(backoff.next()).toBe(10);
    expect(backoff.next()).toBe(10);
  });

  it('should apply jitter within the configured range', () => {
    // Math.random() returns 0; jitter = jitterMin.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const backoff = new ExponentialBackoff({
      baseSeconds: 10,
      maxSeconds: 100,
      jitterMin: 0.5,
      jitterMax: 1.0,
    });

    expect(backoff.next()).toBe(5);
  });

  it('should increment the attempt counter on each next()', () => {
    const backoff = new ExponentialBackoff({ baseSeconds: 1, maxSeconds: 60 });

    expect(backoff.getAttempts()).toBe(0);
    backoff.next();
    expect(backoff.getAttempts()).toBe(1);
    backoff.next();
    expect(backoff.getAttempts()).toBe(2);
  });

  it('should reset the attempt counter and start over', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const backoff = new ExponentialBackoff({
      baseSeconds: 1,
      maxSeconds: 60,
      jitterMin: 1,
      jitterMax: 1,
    });

    backoff.next();
    backoff.next();
    backoff.next();
    expect(backoff.getAttempts()).toBe(3);

    backoff.reset();
    expect(backoff.getAttempts()).toBe(0);
    expect(backoff.next()).toBe(1);
  });

  it('should default jitter to [0.5, 1.0] when not provided', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const backoff = new ExponentialBackoff({ baseSeconds: 4, maxSeconds: 100 });

    // jitter = 0.5 + 0 * (1.0 - 0.5) = 0.5; delay = 4 * 0.5 = 2.
    expect(backoff.next()).toBe(2);
  });
});
