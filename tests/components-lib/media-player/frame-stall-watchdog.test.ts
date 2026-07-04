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
  shouldReportStall: vi.fn().mockReturnValue(true),
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
      const watchdog = new FrameStallWatchdog({ shouldReportStall: () => true });
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
        shouldReportStall: vi.fn().mockReturnValue(false),
      });
      const watchdog = new FrameStallWatchdog(config);
      const callback = vi.fn();

      watchdog.subscribe(callback);
      vi.advanceTimersByTime(STALL_MS);

      expect(callback).not.toHaveBeenCalled();
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
  });

  describe('no available source', () => {
    it('should never report stalled when the source is unavailable', () => {
      const config = createConfig({ startSource: vi.fn().mockReturnValue(false) });
      const watchdog = new FrameStallWatchdog(config);
      const callback = vi.fn();

      watchdog.subscribe(callback);
      vi.advanceTimersByTime(STALL_MS);

      expect(callback).not.toHaveBeenCalled();
      expect(config.shouldReportStall).not.toHaveBeenCalled();
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
