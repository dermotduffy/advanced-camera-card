import { assert, describe, expect, it } from 'vitest';

import {
  LAG_SAMPLE_WINDOW_SIZE,
  NonWebKitLiveEdgeStrategy,
} from '../../../../../../../src/components-lib/live/providers/go2rtc-experimental/utils/live-edge-tracker/non-webkit';
import { createStatus } from './test-utils';

describe('NonWebKitLiveEdgeStrategy', () => {
  it('should play at realtime when close to the live edge', () => {
    const strategy = new NonWebKitLiveEdgeStrategy();
    expect(strategy.next(createStatus(20, 18))).toEqual({ action: 'rate', rate: 1 });
  });

  it('should nudge the rate up when lag exceeds the stream norm', () => {
    const strategy = new NonWebKitLiveEdgeStrategy();
    for (let i = 0; i < LAG_SAMPLE_WINDOW_SIZE; ++i) {
      strategy.next(createStatus(20, 19));
    }

    const action = strategy.next(createStatus(20, 15));

    assert(action.action === 'rate');
    expect(action.rate).toBeGreaterThan(1);
    expect(action.rate).toBeLessThanOrEqual(2);
  });

  it('should cap the catch-up rate', () => {
    const strategy = new NonWebKitLiveEdgeStrategy();
    for (let i = 0; i < LAG_SAMPLE_WINDOW_SIZE; ++i) {
      strategy.next(createStatus(20, 20));
    }

    expect(strategy.next(createStatus(60, 10))).toEqual({ action: 'rate', rate: 2 });
  });

  it('should stay near realtime within the stream normal lag', () => {
    const strategy = new NonWebKitLiveEdgeStrategy();
    for (let i = 0; i < LAG_SAMPLE_WINDOW_SIZE; ++i) {
      strategy.next(createStatus(24, 20));
    }

    const action = strategy.next(createStatus(24, 20));

    assert(action.action === 'rate');
    expect(action.rate).toBeCloseTo(1, 2);
  });

  it('should catch up hard before any baseline samples exist', () => {
    const strategy = new NonWebKitLiveEdgeStrategy();

    // The very first sample is taken while already catching up, so it is
    // excluded and there is no average to temper the threshold.
    expect(strategy.next(createStatus(20, 15, { playbackRate: 2 }))).toEqual({
      action: 'rate',
      rate: 2,
    });
  });

  it('should drop stale lag samples as the stream recovers', () => {
    const strategy = new NonWebKitLiveEdgeStrategy();
    for (let i = 0; i < LAG_SAMPLE_WINDOW_SIZE; ++i) {
      strategy.next(createStatus(26, 20));
    }
    // A full window of low lag evicts the earlier high-lag samples.
    for (let i = 0; i < LAG_SAMPLE_WINDOW_SIZE; ++i) {
      strategy.next(createStatus(21, 20));
    }

    const action = strategy.next(createStatus(25, 20));

    assert(action.action === 'rate');
    expect(action.rate).toBeGreaterThan(1.1);
  });
});
