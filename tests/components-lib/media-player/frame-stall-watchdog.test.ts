import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FRAME_STALL_SECONDS,
  FrameStallWatchdog,
  type FrameStallWatchdogConfig,
} from '../../../src/components-lib/media-player/frame-stall-watchdog';

const STALL_MS = FRAME_STALL_SECONDS * 1000;

const createConfig = (
  overrides?: Partial<FrameStallWatchdogConfig>,
): FrameStallWatchdogConfig => ({
  isPlaybackExpected: vi.fn().mockReturnValue(true),
  startSource: vi.fn().mockReturnValue(true),
  stopSource: vi.fn(),
  ...overrides,
});

// @vitest-environment jsdom
describe('FrameStallWatchdog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('source lifecycle', () => {
    it('should hand a later subscriber what has already been observed', () => {
      const watchdog = new FrameStallWatchdog(createConfig());
      watchdog.subscribe(vi.fn());
      watchdog.notifyFrame();

      const later = vi.fn();
      watchdog.subscribe(later);

      // Observation has been continuous, so the frame just seen is current
      // evidence for the newcomer too.
      expect(later).toHaveBeenCalledWith(true);
    });

    it('should tell a later subscriber nothing before anything is observed', () => {
      const watchdog = new FrameStallWatchdog(createConfig());
      watchdog.subscribe(vi.fn());

      const later = vi.fn();
      watchdog.subscribe(later);

      expect(later).not.toHaveBeenCalled();
    });

    it('should start the source only on the first subscriber', () => {
      const config = createConfig();
      const watchdog = new FrameStallWatchdog(config);

      watchdog.subscribe(vi.fn());
      watchdog.subscribe(vi.fn());

      expect(config.startSource).toHaveBeenCalledTimes(1);
    });

    it('should stop the source only on the last unsubscribe', () => {
      const config = createConfig();
      const watchdog = new FrameStallWatchdog(config);

      const unsubscribeFirst = watchdog.subscribe(vi.fn());
      const unsubscribeSecond = watchdog.subscribe(vi.fn());

      unsubscribeFirst();
      expect(config.stopSource).not.toHaveBeenCalled();

      unsubscribeSecond();
      expect(config.stopSource).toHaveBeenCalledTimes(1);
    });

    it('should default to an always-available source needing no teardown', () => {
      const watchdog = new FrameStallWatchdog({ isPlaybackExpected: () => true });
      const callback = vi.fn();

      const unsubscribe = watchdog.subscribe(callback);
      vi.advanceTimersByTime(STALL_MS);
      unsubscribe(); // no stopSource configured -> no throw

      expect(callback).toHaveBeenCalledWith(false);
    });
  });

  describe('stall detection', () => {
    it('should report stalled when no frame arrives within the window', () => {
      const config = createConfig();
      const watchdog = new FrameStallWatchdog(config);
      const callback = vi.fn();

      watchdog.subscribe(callback);
      vi.advanceTimersByTime(STALL_MS);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(false);
    });

    it('should stay live while frames keep arriving within the window', () => {
      const config = createConfig();
      const watchdog = new FrameStallWatchdog(config);
      const callback = vi.fn();

      watchdog.subscribe(callback);
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(STALL_MS - 1000);
        watchdog.notifyFrame();
      }
      vi.advanceTimersByTime(STALL_MS - 1000);

      // Confirmed live on the first frame, and never stalled thereafter.
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(true);
    });

    it('should report live again once a frame arrives after a stall', () => {
      const config = createConfig();
      const watchdog = new FrameStallWatchdog(config);
      const callback = vi.fn();

      watchdog.subscribe(callback);
      vi.advanceTimersByTime(STALL_MS);
      expect(callback).toHaveBeenNthCalledWith(1, false);

      watchdog.notifyFrame();
      expect(callback).toHaveBeenNthCalledWith(2, true);
    });

    it('should not report stalled while the source is legitimately idle', () => {
      const config = createConfig({
        isPlaybackExpected: vi.fn().mockReturnValue(false),
      });
      const watchdog = new FrameStallWatchdog(config);
      const callback = vi.fn();

      watchdog.subscribe(callback);
      vi.advanceTimersByTime(STALL_MS);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should re-arm while idle so a freeze that becomes actionable later is caught', () => {
      const isPlaybackExpected = vi.fn().mockReturnValue(false);
      const config = createConfig({ isPlaybackExpected });
      const watchdog = new FrameStallWatchdog(config);
      const callback = vi.fn();

      watchdog.subscribe(callback);

      // Idle window: no stall reported, but the watchdog re-arms rather than
      // stopping.
      vi.advanceTimersByTime(STALL_MS);
      expect(callback).not.toHaveBeenCalled();

      // The source becomes actionable while still frozen (holding a frame), with
      // no new frame to kick the timer. The re-armed timer catches the freeze on
      // the next window.
      isPlaybackExpected.mockReturnValue(true);
      vi.advanceTimersByTime(STALL_MS);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(false);
    });

    it('should broadcast a stall to every subscriber', () => {
      const config = createConfig();
      const watchdog = new FrameStallWatchdog(config);
      const first = vi.fn();
      const second = vi.fn();

      watchdog.subscribe(first);
      watchdog.subscribe(second);
      vi.advanceTimersByTime(STALL_MS);

      expect(first).toHaveBeenCalledTimes(1);
      expect(first).toHaveBeenCalledWith(false);
      expect(second).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledWith(false);
    });

    it('should not report live merely on subscribing before any frame', () => {
      const config = createConfig();
      const watchdog = new FrameStallWatchdog(config);
      const callback = vi.fn();

      // Unconfirmed until a real frame arrives: subscribing alone does not
      // report live.
      watchdog.subscribe(callback);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should confirm live on the first frame but not re-notify on the next', () => {
      const config = createConfig();
      const watchdog = new FrameStallWatchdog(config);
      const callback = vi.fn();

      watchdog.subscribe(callback);
      watchdog.notifyFrame();
      watchdog.notifyFrame();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(true);
    });

    it('should use the stall window in force when the timer is armed', () => {
      let stallAfterSeconds = 30;
      const watchdog = new FrameStallWatchdog(
        createConfig({ getStallAfterSeconds: () => stallAfterSeconds }),
      );
      const callback = vi.fn();
      watchdog.subscribe(callback);

      // The source slows down: the frame that arrives re-arms with the new,
      // shorter window rather than the one the watchdog started with.
      stallAfterSeconds = 5;
      watchdog.notifyFrame();
      vi.advanceTimersByTime(5 * 1000);

      expect(callback).toHaveBeenLastCalledWith(false);
    });
  });

  describe('no available source', () => {
    it('should never report stalled when the source is unavailable', () => {
      const config = createConfig({ startSource: vi.fn().mockReturnValue(false) });
      const watchdog = new FrameStallWatchdog(config);
      const callback = vi.fn();

      watchdog.subscribe(callback);
      vi.advanceTimersByTime(STALL_MS);

      expect(callback).not.toHaveBeenCalled();
      expect(config.isPlaybackExpected).not.toHaveBeenCalled();
    });

    it('should ignore notifyFrame when the source is unavailable', () => {
      const config = createConfig({ startSource: vi.fn().mockReturnValue(false) });
      const watchdog = new FrameStallWatchdog(config);
      const callback = vi.fn();

      watchdog.subscribe(callback);
      watchdog.notifyFrame();
      vi.advanceTimersByTime(STALL_MS);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should not stop a source that was never started on unsubscribe', () => {
      const config = createConfig({ startSource: vi.fn().mockReturnValue(false) });
      const watchdog = new FrameStallWatchdog(config);

      const unsubscribe = watchdog.subscribe(vi.fn());
      unsubscribe();

      expect(config.stopSource).not.toHaveBeenCalled();
    });
  });

  describe('teardown', () => {
    it('should not report a stall after the last subscriber leaves', () => {
      const config = createConfig();
      const watchdog = new FrameStallWatchdog(config);
      const callback = vi.fn();

      const unsubscribe = watchdog.subscribe(callback);
      unsubscribe();
      vi.advanceTimersByTime(STALL_MS);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should stop cleanly if the last subscriber unsubscribes during a recovery notification', () => {
      const config = createConfig();
      const watchdog = new FrameStallWatchdog(config);
      let unsubscribe: () => void = () => {};
      const callback = vi.fn((isLive: boolean) => {
        if (isLive) {
          unsubscribe();
        }
      });

      unsubscribe = watchdog.subscribe(callback);

      // Stall -> callback(false)
      vi.advanceTimersByTime(STALL_MS);

      // Recovery -> callback(true) -> unsubscribe -> stop
      watchdog.notifyFrame();

      expect(config.stopSource).toHaveBeenCalledTimes(1);

      // The timer armed by notifyFrame must have been stopped, so no further
      // stall fires with no subscribers.
      callback.mockClear();
      vi.advanceTimersByTime(STALL_MS);
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
