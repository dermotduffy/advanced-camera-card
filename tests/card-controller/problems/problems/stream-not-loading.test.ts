import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StreamNotLoadingProblem } from '../../../../src/card-controller/problems/problems/stream-not-loading';

// @vitest-environment jsdom
describe('StreamNotLoadingProblem', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should have correct key', () => {
    const problem = new StreamNotLoadingProblem(vi.fn());
    expect(problem.key).toBe('stream_not_loading');
  });

  describe('detectDynamic', () => {
    it('should start timer when live and not loaded', () => {
      const triggerUpdate = vi.fn();
      const problem = new StreamNotLoadingProblem(triggerUpdate);

      problem.detectDynamic({ view: 'live', mediaLoaded: false });

      expect(problem.hasResult()).toBe(false);

      vi.advanceTimersByTime(10000);

      expect(problem.hasResult()).toBe(true);
      expect(triggerUpdate).toBeCalled();
    });

    it('should not start timer when not live', () => {
      const problem = new StreamNotLoadingProblem(vi.fn());

      problem.detectDynamic({ view: 'media', mediaLoaded: false });

      vi.advanceTimersByTime(10000);

      expect(problem.hasResult()).toBe(false);
    });

    it('should not start timer when media is loaded', () => {
      const problem = new StreamNotLoadingProblem(vi.fn());

      problem.detectDynamic({ view: 'live', mediaLoaded: true });

      vi.advanceTimersByTime(10000);

      expect(problem.hasResult()).toBe(false);
    });

    it('should clear timeout when media loads', () => {
      const problem = new StreamNotLoadingProblem(vi.fn());

      problem.detectDynamic({ view: 'live', mediaLoaded: false });
      vi.advanceTimersByTime(5000);

      problem.detectDynamic({ view: 'live', mediaLoaded: true });

      vi.advanceTimersByTime(5000);

      expect(problem.hasResult()).toBe(false);
    });

    it('should clear timeout when view changes away from live', () => {
      const problem = new StreamNotLoadingProblem(vi.fn());

      problem.detectDynamic({ view: 'live', mediaLoaded: false });
      vi.advanceTimersByTime(5000);

      problem.detectDynamic({ view: 'media', mediaLoaded: false });

      vi.advanceTimersByTime(5000);

      expect(problem.hasResult()).toBe(false);
    });

    it('should clear timed-out state when media loads', () => {
      const problem = new StreamNotLoadingProblem(vi.fn());

      problem.detectDynamic({ view: 'live', mediaLoaded: false });
      vi.advanceTimersByTime(10000);
      expect(problem.hasResult()).toBe(true);

      problem.detectDynamic({ view: 'live', mediaLoaded: true });
      expect(problem.hasResult()).toBe(false);
    });

    it('should restart timer when camera changes', () => {
      const triggerUpdate = vi.fn();
      const problem = new StreamNotLoadingProblem(triggerUpdate);

      problem.detectDynamic({
        cameraID: 'camera-1',
        view: 'live',
        mediaLoaded: false,
      });
      vi.advanceTimersByTime(5000);

      // Switch to camera-2: timer restarts from 0 for the new camera.
      problem.detectDynamic({
        cameraID: 'camera-2',
        view: 'live',
        mediaLoaded: false,
      });

      // 5 more seconds is not enough for the new 10s timer.
      vi.advanceTimersByTime(5000);
      expect(problem.hasResult()).toBe(false);

      // Full 10s from camera-2's timer start.
      vi.advanceTimersByTime(5000);
      expect(problem.hasResult()).toBe(true);
      expect(triggerUpdate).toBeCalledTimes(1);
    });

    it('should not restart timer for same camera while running', () => {
      const triggerUpdate = vi.fn();
      const problem = new StreamNotLoadingProblem(triggerUpdate);

      problem.detectDynamic({
        cameraID: 'camera-1',
        view: 'live',
        mediaLoaded: false,
      });
      vi.advanceTimersByTime(5000);

      // Same camera again: timer should continue, not restart.
      problem.detectDynamic({
        cameraID: 'camera-1',
        view: 'live',
        mediaLoaded: false,
      });

      // 5 more seconds completes the original 10s timer.
      vi.advanceTimersByTime(5000);
      expect(problem.hasResult()).toBe(true);
      expect(triggerUpdate).toBeCalledTimes(1);
    });

    it('should not restart timer when cameraID is undefined and matches', () => {
      const triggerUpdate = vi.fn();
      const problem = new StreamNotLoadingProblem(triggerUpdate);

      problem.detectDynamic({ view: 'live', mediaLoaded: false });
      vi.advanceTimersByTime(5000);

      // Same undefined cameraID: timer should continue.
      problem.detectDynamic({ view: 'live', mediaLoaded: false });

      vi.advanceTimersByTime(5000);
      expect(problem.hasResult()).toBe(true);
      expect(triggerUpdate).toBeCalledTimes(1);
    });

    it('should not restart timer if already timed out', () => {
      const triggerUpdate = vi.fn();
      const problem = new StreamNotLoadingProblem(triggerUpdate);

      problem.detectDynamic({ view: 'live', mediaLoaded: false });
      vi.advanceTimersByTime(10000);
      expect(triggerUpdate).toBeCalledTimes(1);

      // Calling detectDynamic again should not restart timer.
      problem.detectDynamic({ view: 'live', mediaLoaded: false });
      vi.advanceTimersByTime(10000);
      expect(triggerUpdate).toBeCalledTimes(1);
    });
  });

  describe('trigger', () => {
    it('should activate immediately when camera has error and view is live', () => {
      const problem = new StreamNotLoadingProblem(vi.fn());

      problem.trigger({ cameraID: 'camera-1' });
      problem.detectDynamic({
        cameraID: 'camera-1',
        view: 'live',
        mediaLoaded: false,
      });

      expect(problem.hasResult()).toBe(true);
    });

    it('should not activate with only a trigger', () => {
      const problem = new StreamNotLoadingProblem(vi.fn());

      problem.trigger({ cameraID: 'camera-1' });

      expect(problem.hasResult()).toBe(false);
    });

    it('should ignore trigger without cameraID', () => {
      const problem = new StreamNotLoadingProblem(vi.fn());

      problem.trigger();
      problem.detectDynamic({ view: 'live', mediaLoaded: false });

      // No camera error recorded, so falls back to timeout behavior.
      expect(problem.hasResult()).toBe(false);
    });

    it('should clear camera error when stream loads', () => {
      const problem = new StreamNotLoadingProblem(vi.fn());

      problem.trigger({ cameraID: 'camera-1' });
      problem.detectDynamic({
        cameraID: 'camera-1',
        view: 'live',
        mediaLoaded: false,
      });

      expect(problem.hasResult()).toBe(true);

      // Stream loaded clears the error for this camera.
      problem.detectDynamic({
        cameraID: 'camera-1',
        view: 'live',
        mediaLoaded: true,
      });

      // Camera error was cleared by the successful load, so this unloaded state
      // falls back to the timer (problem would not activate until after the
      // timer is reached).
      problem.detectDynamic({
        cameraID: 'camera-1',
        view: 'live',
        mediaLoaded: false,
      });

      expect(problem.hasResult()).toBe(false);
    });

    it('should not activate for a different camera', () => {
      const problem = new StreamNotLoadingProblem(vi.fn());

      problem.trigger({ cameraID: 'camera-1' });
      problem.detectDynamic({
        cameraID: 'camera-2',
        view: 'live',
        mediaLoaded: false,
      });

      // camera-2 has no error, so it falls back to timeout behavior.
      expect(problem.hasResult()).toBe(false);
    });
  });

  describe('getNotification', () => {
    it('should return notification regardless of active state', () => {
      const problem = new StreamNotLoadingProblem(vi.fn());

      const notification = problem.getNotification();
      expect(notification).toEqual(
        expect.objectContaining({
          heading: expect.objectContaining({
            text: expect.any(String),
          }),
          link: expect.objectContaining({
            url: expect.any(String),
          }),
        }),
      );
    });
  });

  describe('getResult', () => {
    it('should return result when timed out', () => {
      const problem = new StreamNotLoadingProblem(vi.fn());

      problem.detectDynamic({ view: 'live', mediaLoaded: false });
      vi.advanceTimersByTime(10000);

      const result = problem.getResult();
      expect(result).toEqual(
        expect.objectContaining({
          icon: 'mdi:cctv-off',
          severity: 'high',
          notification: expect.objectContaining({
            link: expect.objectContaining({
              url: expect.any(String),
            }),
          }),
        }),
      );
    });

    it('should return null when not timed out', () => {
      const problem = new StreamNotLoadingProblem(vi.fn());

      expect(problem.getResult()).toBeNull();
    });
  });

  describe('destroy', () => {
    it('should stop timer', () => {
      const triggerUpdate = vi.fn();
      const problem = new StreamNotLoadingProblem(triggerUpdate);

      problem.detectDynamic({ view: 'live', mediaLoaded: false });
      problem.destroy();

      vi.advanceTimersByTime(10000);

      expect(problem.hasResult()).toBe(false);
      expect(triggerUpdate).not.toBeCalled();
    });
  });
});
