import { assert, describe, expect, it } from 'vitest';

import {
  LAG_SAMPLE_WINDOW_SIZE,
  LiveEdgeTracker,
} from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/utils/live-edge-tracker';

const status = (
  bufferedEndSeconds: number,
  currentTimeSeconds: number,
  options?: { playbackRate?: number; now?: Date },
) => ({
  bufferedEndSeconds,
  currentTimeSeconds,
  playbackRate: options?.playbackRate ?? 1,
  now: options?.now ?? new Date(0),
});

describe('LiveEdgeTracker', () => {
  describe('on WebKit', () => {
    it('should do nothing when close to the live edge', () => {
      const tracker = new LiveEdgeTracker({ webkit: true });
      expect(tracker.next(status(20, 18))).toEqual({ action: 'none' });
    });

    it('should jump near the live edge when far behind', () => {
      const tracker = new LiveEdgeTracker({ webkit: true });
      expect(tracker.next(status(20, 15))).toEqual({ action: 'seek', seconds: 19.25 });
    });

    it('should not jump again within the cooldown', () => {
      const tracker = new LiveEdgeTracker({ webkit: true });
      tracker.next(status(20, 15, { now: new Date(0) }));
      expect(tracker.next(status(20, 15, { now: new Date(2000) }))).toEqual({
        action: 'none',
      });
    });

    it('should jump again after the cooldown', () => {
      const tracker = new LiveEdgeTracker({ webkit: true });
      tracker.next(status(20, 15, { now: new Date(0) }));
      expect(tracker.next(status(20, 15, { now: new Date(6000) }))).toEqual({
        action: 'seek',
        seconds: 19.25,
      });
    });
  });

  describe('on other browsers', () => {
    it('should play at realtime when close to the live edge', () => {
      const tracker = new LiveEdgeTracker({ webkit: false });
      expect(tracker.next(status(20, 18))).toEqual({ action: 'rate', rate: 1 });
    });

    it('should nudge the rate up when lag exceeds the stream norm', () => {
      const tracker = new LiveEdgeTracker({ webkit: false });
      for (let i = 0; i < LAG_SAMPLE_WINDOW_SIZE; ++i) {
        tracker.next(status(20, 19));
      }

      const action = tracker.next(status(20, 15));

      assert(action.action === 'rate');
      expect(action.rate).toBeGreaterThan(1);
      expect(action.rate).toBeLessThanOrEqual(2);
    });

    it('should cap the catch-up rate', () => {
      const tracker = new LiveEdgeTracker({ webkit: false });
      for (let i = 0; i < LAG_SAMPLE_WINDOW_SIZE; ++i) {
        tracker.next(status(20, 20));
      }

      expect(tracker.next(status(60, 10))).toEqual({ action: 'rate', rate: 2 });
    });

    it('should stay near realtime within the stream normal lag', () => {
      const tracker = new LiveEdgeTracker({ webkit: false });
      for (let i = 0; i < LAG_SAMPLE_WINDOW_SIZE; ++i) {
        tracker.next(status(24, 20));
      }

      const action = tracker.next(status(24, 20));

      assert(action.action === 'rate');
      expect(action.rate).toBeCloseTo(1, 2);
    });

    it('should catch up hard before any baseline samples exist', () => {
      const tracker = new LiveEdgeTracker({ webkit: false });

      // The very first sample is taken while already catching up, so it is
      // excluded and there is no average to temper the threshold.
      expect(tracker.next(status(20, 15, { playbackRate: 2 }))).toEqual({
        action: 'rate',
        rate: 2,
      });
    });

    it('should drop stale lag samples as the stream recovers', () => {
      const tracker = new LiveEdgeTracker({ webkit: false });
      for (let i = 0; i < LAG_SAMPLE_WINDOW_SIZE; ++i) {
        tracker.next(status(26, 20));
      }
      // A full window of low lag evicts the earlier high-lag samples.
      for (let i = 0; i < LAG_SAMPLE_WINDOW_SIZE; ++i) {
        tracker.next(status(21, 20));
      }

      const action = tracker.next(status(25, 20));

      assert(action.action === 'rate');
      expect(action.rate).toBeGreaterThan(1.1);
    });
  });
});
