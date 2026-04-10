import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { MediaLoadProblem } from '../../../../src/card-controller/problems/problems/media-load';
import { InternalCallbackActionConfig } from '../../../../src/config/schema/actions/custom/internal';
import { View } from '../../../../src/view/view';
import { createCardAPI, createMediaLoadedInfo } from '../../../test-utils';
import { IMAGE_VIEW_TARGET_ID_SENTINEL } from '../../../../src/view/target-id';

const createAPI = () => createCardAPI();

// @vitest-environment jsdom
describe('MediaLoadProblem', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should have correct key', () => {
    const problem = new MediaLoadProblem(createAPI());
    expect(problem.key).toBe('media_load');
  });

  describe('detectDynamic', () => {
    it.each([
      ['live' as const],
      ['clip' as const],
      ['folder' as const],
      ['media' as const],
      ['snapshot' as const],
      ['recording' as const],
      ['review' as const],
    ])('should start timer when view is %s and not loaded', (view) => {
      const onChange = vi.fn();
      const problem = new MediaLoadProblem(createAPI(), onChange);

      problem.detectDynamic({ view });

      expect(problem.hasProblem()).toBe(false);

      vi.advanceTimersByTime(10000);

      expect(problem.hasProblem()).toBe(true);
      expect(onChange).toBeCalled();
    });

    it('should not start timer when view is not a media view', () => {
      const problem = new MediaLoadProblem(createAPI());

      problem.detectDynamic({ view: 'timeline' });

      vi.advanceTimersByTime(10000);

      expect(problem.hasProblem()).toBe(false);
    });

    it('should not start timer when view is undefined', () => {
      const problem = new MediaLoadProblem(createAPI());

      problem.detectDynamic({});

      vi.advanceTimersByTime(10000);

      expect(problem.hasProblem()).toBe(false);
    });

    it('should not start timer when media is loaded', () => {
      const problem = new MediaLoadProblem(createAPI());

      problem.detectDynamic({ view: 'live', mediaLoadedInfo: createMediaLoadedInfo() });

      vi.advanceTimersByTime(10000);

      expect(problem.hasProblem()).toBe(false);
    });

    it('should clear timeout when media loads', () => {
      const problem = new MediaLoadProblem(createAPI());

      problem.detectDynamic({ view: 'live' });
      vi.advanceTimersByTime(5000);

      problem.detectDynamic({ view: 'live', mediaLoadedInfo: createMediaLoadedInfo() });

      vi.advanceTimersByTime(5000);

      expect(problem.hasProblem()).toBe(false);
    });

    it('should clear timeout when view changes to a non-media view', () => {
      const problem = new MediaLoadProblem(createAPI());

      problem.detectDynamic({ view: 'live' });
      vi.advanceTimersByTime(5000);

      problem.detectDynamic({ view: 'timeline' });

      vi.advanceTimersByTime(5000);

      expect(problem.hasProblem()).toBe(false);
    });

    it('should remain active across media views', () => {
      const problem = new MediaLoadProblem(createAPI());

      problem.detectDynamic({ view: 'live' });
      vi.advanceTimersByTime(10000);
      expect(problem.hasProblem()).toBe(true);

      // Switching between media views keeps the problem active.
      problem.detectDynamic({ view: 'clip' });
      expect(problem.hasProblem()).toBe(true);
    });

    it('should deactivate when target changes to non-errored target', () => {
      const problem = new MediaLoadProblem(createAPI());

      problem.detectDynamic({ targetID: 'camera-1', view: 'live' });
      vi.advanceTimersByTime(10000);
      expect(problem.hasProblem()).toBe(true);

      // Switch to camera-2 which has no error — should deactivate and start
      // a fresh timer for the new target.
      problem.detectDynamic({ targetID: 'camera-2', view: 'live' });
      expect(problem.hasProblem()).toBe(false);

      // camera-2 gets its own timeout window.
      vi.advanceTimersByTime(10000);
      expect(problem.hasProblem()).toBe(true);
    });

    it('should stay active when target changes to errored target', () => {
      const problem = new MediaLoadProblem(createAPI());

      problem.trigger({ targetID: 'camera-1' });
      problem.trigger({ targetID: 'camera-2' });

      problem.detectDynamic({ targetID: 'camera-1', view: 'live' });
      expect(problem.hasProblem()).toBe(true);

      // Switch to camera-2 which also has an error — should stay active.
      problem.detectDynamic({ targetID: 'camera-2', view: 'live' });
      expect(problem.hasProblem()).toBe(true);
    });

    it('should clear timed-out state when media loads', () => {
      const problem = new MediaLoadProblem(createAPI());

      problem.detectDynamic({ view: 'live' });
      vi.advanceTimersByTime(10000);
      expect(problem.hasProblem()).toBe(true);

      problem.detectDynamic({ view: 'live', mediaLoadedInfo: createMediaLoadedInfo() });
      expect(problem.hasProblem()).toBe(false);
    });

    it('should restart timer when target changes', () => {
      const onChange = vi.fn();
      const problem = new MediaLoadProblem(createAPI(), onChange);

      problem.detectDynamic({
        targetID: 'camera-1',
        view: 'live',
      });
      vi.advanceTimersByTime(5000);

      // Switch to camera-2: timer restarts from 0 for the new target.
      problem.detectDynamic({
        targetID: 'camera-2',
        view: 'live',
      });

      // 5 more seconds is not enough for the new 10s timer.
      vi.advanceTimersByTime(5000);
      expect(problem.hasProblem()).toBe(false);

      // Full 10s from camera-2's timer start.
      vi.advanceTimersByTime(5000);
      expect(problem.hasProblem()).toBe(true);
      expect(onChange).toBeCalledTimes(1);
    });

    it('should not restart timer for same target while running', () => {
      const onChange = vi.fn();
      const problem = new MediaLoadProblem(createAPI(), onChange);

      problem.detectDynamic({
        targetID: 'camera-1',
        view: 'live',
      });
      vi.advanceTimersByTime(5000);

      // Same target again: timer should continue, not restart.
      problem.detectDynamic({
        targetID: 'camera-1',
        view: 'live',
      });

      // 5 more seconds completes the original 10s timer.
      vi.advanceTimersByTime(5000);
      expect(problem.hasProblem()).toBe(true);
      expect(onChange).toBeCalledTimes(1);
    });

    it('should not restart timer when targetID is undefined and matches', () => {
      const onChange = vi.fn();
      const problem = new MediaLoadProblem(createAPI(), onChange);

      problem.detectDynamic({ view: 'live' });
      vi.advanceTimersByTime(5000);

      // Same undefined target: timer should continue.
      problem.detectDynamic({ view: 'live' });

      vi.advanceTimersByTime(5000);
      expect(problem.hasProblem()).toBe(true);
      expect(onChange).toBeCalledTimes(1);
    });

    it('should not restart timer if already timed out', () => {
      const onChange = vi.fn();
      const problem = new MediaLoadProblem(createAPI(), onChange);

      problem.detectDynamic({ view: 'live' });
      vi.advanceTimersByTime(10000);
      expect(onChange).toBeCalledTimes(1);

      // Calling detectDynamic again should not restart timer.
      problem.detectDynamic({ view: 'live' });
      vi.advanceTimersByTime(10000);
      expect(onChange).toBeCalledTimes(1);
    });
  });

  describe('trigger', () => {
    it('should activate immediately when target has error and view is a media view', () => {
      const problem = new MediaLoadProblem(createAPI());

      problem.trigger({ targetID: 'camera-1' });
      problem.detectDynamic({
        targetID: 'camera-1',
        view: 'live',
      });

      expect(problem.hasProblem()).toBe(true);
    });

    it('should not activate with only a trigger', () => {
      const problem = new MediaLoadProblem(createAPI());

      problem.trigger({ targetID: 'camera-1' });

      expect(problem.hasProblem()).toBe(false);
    });

    it('should clear target error when media loads', () => {
      const problem = new MediaLoadProblem(createAPI());

      problem.trigger({ targetID: 'camera-1' });
      problem.detectDynamic({
        targetID: 'camera-1',
        view: 'live',
      });

      expect(problem.hasProblem()).toBe(true);

      // Media loaded clears the error for this target.
      problem.detectDynamic({
        targetID: 'camera-1',
        view: 'live',
        mediaLoadedInfo: createMediaLoadedInfo(),
      });

      // Target error was cleared by the successful load, so this unloaded state
      // falls back to the timer (problem would not activate until after the
      // timer is reached).
      problem.detectDynamic({
        targetID: 'camera-1',
        view: 'live',
      });

      expect(problem.hasProblem()).toBe(false);
    });

    it('should not activate for a different target', () => {
      const problem = new MediaLoadProblem(createAPI());

      problem.trigger({ targetID: 'camera-1' });
      problem.detectDynamic({
        targetID: 'camera-2',
        view: 'live',
      });

      // camera-2 has no error, so it falls back to timeout behavior.
      expect(problem.hasProblem()).toBe(false);
    });
  });

  describe('getNotification', () => {
    it('should return notification regardless of active state', () => {
      const problem = new MediaLoadProblem(createAPI());

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

    it('should include a retry control with wired callback', async () => {
      const api = createCardAPI();
      const problem = new MediaLoadProblem(api);

      const control = problem.getNotification().controls?.[0];
      expect(control).toMatchObject({ icon: 'mdi:refresh', dismiss: true });

      const tapAction = control?.actions?.tap_action as InternalCallbackActionConfig;
      await tapAction.callback(api);

      expect(api.getProblemManager().retry).toBeCalledWith('media_load', true);
    });
  });

  describe('getProblem', () => {
    it('should return result when timed out', () => {
      const problem = new MediaLoadProblem(createAPI());

      problem.detectDynamic({ view: 'live' });
      vi.advanceTimersByTime(10000);

      const result = problem.getProblem();
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
      const problem = new MediaLoadProblem(createAPI());

      expect(problem.getProblem()).toBeNull();
    });
  });

  describe('needsRetry', () => {
    it('should return true when problem is active', () => {
      const problem = new MediaLoadProblem(createAPI());

      problem.detectDynamic({ view: 'live' });
      vi.advanceTimersByTime(10000);

      expect(problem.needsRetry()).toBe(true);
    });

    it('should return false when problem is not active', () => {
      const problem = new MediaLoadProblem(createAPI());

      expect(problem.needsRetry()).toBe(false);
    });
  });

  describe('retry', () => {
    it('should deactivate problem and reset timer', () => {
      const onChange = vi.fn();
      const problem = new MediaLoadProblem(createAPI(), onChange);

      problem.detectDynamic({ view: 'live' });
      vi.advanceTimersByTime(10000);
      expect(problem.hasProblem()).toBe(true);

      problem.retry();

      expect(problem.hasProblem()).toBe(false);
      // Timer should not re-fire after retry.
      vi.advanceTimersByTime(10000);
      expect(onChange).toBeCalledTimes(1); // Only the original activation.
    });

    it('should deactivate pending timer before timeout', () => {
      const onChange = vi.fn();
      const problem = new MediaLoadProblem(createAPI(), onChange);

      problem.detectDynamic({ view: 'live' });
      vi.advanceTimersByTime(5000);

      problem.retry();

      // Timer was stopped — should not fire.
      vi.advanceTimersByTime(10000);
      expect(problem.hasProblem()).toBe(false);
      expect(onChange).not.toBeCalled();
    });

    it('should return false when no targets have errors', () => {
      const api = createAPI();
      const problem = new MediaLoadProblem(api);

      expect(problem.retry()).toBe(false);
    });

    it('should bump mediaEpoch for targets with errors and call setViewWithMergedContext', () => {
      const api = createAPI();
      vi.mocked(api.getViewManager().getView).mockReturnValue(mock<View>());
      const problem = new MediaLoadProblem(api);

      problem.trigger({ targetID: 'camera-1' });
      problem.trigger({ targetID: 'media-1' });

      const result = problem.retry();

      expect(result).toEqual(false);
      expect(api.getViewManager().setViewWithMergedContext).toBeCalledWith({
        mediaEpoch: { 'camera-1': 1, 'media-1': 1 },
      });
    });

    it('should bump mediaEpoch for the image-view sentinel', () => {
      const api = createAPI();
      vi.mocked(api.getViewManager().getView).mockReturnValue(mock<View>());
      const problem = new MediaLoadProblem(api);

      problem.trigger({ targetID: IMAGE_VIEW_TARGET_ID_SENTINEL });

      const result = problem.retry();

      expect(result).toEqual(false);
      expect(api.getViewManager().setViewWithMergedContext).toBeCalledWith({
        mediaEpoch: { [IMAGE_VIEW_TARGET_ID_SENTINEL]: 1 },
      });
    });

    it('should increment existing epoch values from current view context', () => {
      const api = createAPI();
      vi.mocked(api.getViewManager().getView).mockReturnValue(
        mock<View>({ context: { mediaEpoch: { 'camera-1': 5, 'camera-2': 3 } } }),
      );
      const problem = new MediaLoadProblem(api);

      problem.trigger({ targetID: 'camera-1' });

      const result = problem.retry();

      expect(result).toEqual(false);
      expect(api.getViewManager().setViewWithMergedContext).toBeCalledWith({
        mediaEpoch: { 'camera-1': 6, 'camera-2': 3 },
      });
    });

    it('should include pending timer target in retry', () => {
      const api = createAPI();
      vi.mocked(api.getViewManager().getView).mockReturnValue(mock<View>());
      const problem = new MediaLoadProblem(api);

      // Start the timer for camera-1 (not yet timed out).
      problem.detectDynamic({ targetID: 'camera-1', view: 'live' });

      problem.retry();

      expect(api.getViewManager().setViewWithMergedContext).toBeCalledWith({
        mediaEpoch: { 'camera-1': 1 },
      });
    });

    it('should clear errored targets after retry', () => {
      const api = createAPI();
      vi.mocked(api.getViewManager().getView).mockReturnValue(mock<View>());
      const problem = new MediaLoadProblem(api);

      problem.trigger({ targetID: 'camera-1' });
      problem.retry();

      // After retry, the errored target is cleared — detecting the same
      // target without media does not immediately activate.
      problem.detectDynamic({ targetID: 'camera-1', view: 'live' });
      expect(problem.hasProblem()).toBe(false);
    });
  });

  describe('reset', () => {
    it('should stop timer', () => {
      const onChange = vi.fn();
      const problem = new MediaLoadProblem(createAPI(), onChange);

      problem.detectDynamic({ view: 'live' });
      problem.reset();

      vi.advanceTimersByTime(10000);

      expect(problem.hasProblem()).toBe(false);
      expect(onChange).not.toBeCalled();
    });
  });
});
