import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { MediaLoadIssue } from '../../../../src/card-controller/issues/issues/media-load';
import { InternalCallbackActionConfig } from '../../../../src/config/schema/actions/custom/internal';
import { View } from '../../../../src/view/view';
import { createCardAPI, createMediaLoadedInfo } from '../../../test-utils';
import { IMAGE_VIEW_TARGET_ID_SENTINEL } from '../../../../src/view/target-id';

const createAPI = () => createCardAPI();

// @vitest-environment jsdom
describe('MediaLoadIssue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should have correct key', () => {
    const issue = new MediaLoadIssue(createAPI());
    expect(issue.key).toBe('media_load');
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
      const issue = new MediaLoadIssue(createAPI(), onChange);

      issue.detectDynamic({ view });

      expect(issue.hasIssue()).toBe(false);

      vi.advanceTimersByTime(10000);

      expect(issue.hasIssue()).toBe(true);
      expect(onChange).toBeCalled();
    });

    it('should not start timer when view is not a media view', () => {
      const issue = new MediaLoadIssue(createAPI());

      issue.detectDynamic({ view: 'timeline' });

      vi.advanceTimersByTime(10000);

      expect(issue.hasIssue()).toBe(false);
    });

    it('should not start timer when view is undefined', () => {
      const issue = new MediaLoadIssue(createAPI());

      issue.detectDynamic({});

      vi.advanceTimersByTime(10000);

      expect(issue.hasIssue()).toBe(false);
    });

    it('should not start timer when media is loaded', () => {
      const issue = new MediaLoadIssue(createAPI());

      issue.detectDynamic({ view: 'live', mediaLoadedInfo: createMediaLoadedInfo() });

      vi.advanceTimersByTime(10000);

      expect(issue.hasIssue()).toBe(false);
    });

    it('should clear timeout when media loads', () => {
      const issue = new MediaLoadIssue(createAPI());

      issue.detectDynamic({ view: 'live' });
      vi.advanceTimersByTime(5000);

      issue.detectDynamic({ view: 'live', mediaLoadedInfo: createMediaLoadedInfo() });

      vi.advanceTimersByTime(5000);

      expect(issue.hasIssue()).toBe(false);
    });

    it('should clear timeout when view changes to a non-media view', () => {
      const issue = new MediaLoadIssue(createAPI());

      issue.detectDynamic({ view: 'live' });
      vi.advanceTimersByTime(5000);

      issue.detectDynamic({ view: 'timeline' });

      vi.advanceTimersByTime(5000);

      expect(issue.hasIssue()).toBe(false);
    });

    it('should remain active across media views', () => {
      const issue = new MediaLoadIssue(createAPI());

      issue.detectDynamic({ view: 'live' });
      vi.advanceTimersByTime(10000);
      expect(issue.hasIssue()).toBe(true);

      // Switching between media views keeps the issue active.
      issue.detectDynamic({ view: 'clip' });
      expect(issue.hasIssue()).toBe(true);
    });

    it('should deactivate when target changes to non-errored target', () => {
      const issue = new MediaLoadIssue(createAPI());

      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });
      vi.advanceTimersByTime(10000);
      expect(issue.hasIssue()).toBe(true);

      // Switch to camera-2 which has no error — should deactivate and start
      // a fresh timer for the new target.
      issue.detectDynamic({ targetID: 'camera-2', view: 'live' });
      expect(issue.hasIssue()).toBe(false);

      // camera-2 gets its own timeout window.
      vi.advanceTimersByTime(10000);
      expect(issue.hasIssue()).toBe(true);
    });

    it('should stay active when target changes to errored target', () => {
      const issue = new MediaLoadIssue(createAPI());

      issue.trigger({ targetID: 'camera-1' });
      issue.trigger({ targetID: 'camera-2' });

      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });
      expect(issue.hasIssue()).toBe(true);

      // Switch to camera-2 which also has an error — should stay active.
      issue.detectDynamic({ targetID: 'camera-2', view: 'live' });
      expect(issue.hasIssue()).toBe(true);
    });

    it('should clear timed-out state when media loads', () => {
      const issue = new MediaLoadIssue(createAPI());

      issue.detectDynamic({ view: 'live' });
      vi.advanceTimersByTime(10000);
      expect(issue.hasIssue()).toBe(true);

      issue.detectDynamic({ view: 'live', mediaLoadedInfo: createMediaLoadedInfo() });
      expect(issue.hasIssue()).toBe(false);
    });

    it('should restart timer when target changes', () => {
      const onChange = vi.fn();
      const issue = new MediaLoadIssue(createAPI(), onChange);

      issue.detectDynamic({
        targetID: 'camera-1',
        view: 'live',
      });
      vi.advanceTimersByTime(5000);

      // Switch to camera-2: timer restarts from 0 for the new target.
      issue.detectDynamic({
        targetID: 'camera-2',
        view: 'live',
      });

      // 5 more seconds is not enough for the new 10s timer.
      vi.advanceTimersByTime(5000);
      expect(issue.hasIssue()).toBe(false);

      // Full 10s from camera-2's timer start.
      vi.advanceTimersByTime(5000);
      expect(issue.hasIssue()).toBe(true);
      expect(onChange).toBeCalledTimes(1);
    });

    it('should not restart timer for same target while running', () => {
      const onChange = vi.fn();
      const issue = new MediaLoadIssue(createAPI(), onChange);

      issue.detectDynamic({
        targetID: 'camera-1',
        view: 'live',
      });
      vi.advanceTimersByTime(5000);

      // Same target again: timer should continue, not restart.
      issue.detectDynamic({
        targetID: 'camera-1',
        view: 'live',
      });

      // 5 more seconds completes the original 10s timer.
      vi.advanceTimersByTime(5000);
      expect(issue.hasIssue()).toBe(true);
      expect(onChange).toBeCalledTimes(1);
    });

    it('should not restart timer when targetID is undefined and matches', () => {
      const onChange = vi.fn();
      const issue = new MediaLoadIssue(createAPI(), onChange);

      issue.detectDynamic({ view: 'live' });
      vi.advanceTimersByTime(5000);

      // Same undefined target: timer should continue.
      issue.detectDynamic({ view: 'live' });

      vi.advanceTimersByTime(5000);
      expect(issue.hasIssue()).toBe(true);
      expect(onChange).toBeCalledTimes(1);
    });

    it('should not restart timer if already timed out', () => {
      const onChange = vi.fn();
      const issue = new MediaLoadIssue(createAPI(), onChange);

      issue.detectDynamic({ view: 'live' });
      vi.advanceTimersByTime(10000);
      expect(onChange).toBeCalledTimes(1);

      // Calling detectDynamic again should not restart timer.
      issue.detectDynamic({ view: 'live' });
      vi.advanceTimersByTime(10000);
      expect(onChange).toBeCalledTimes(1);
    });
  });

  describe('trigger', () => {
    it('should activate immediately when target has error and view is a media view', () => {
      const issue = new MediaLoadIssue(createAPI());

      issue.trigger({ targetID: 'camera-1' });
      issue.detectDynamic({
        targetID: 'camera-1',
        view: 'live',
      });

      expect(issue.hasIssue()).toBe(true);
    });

    it('should not activate with only a trigger', () => {
      const issue = new MediaLoadIssue(createAPI());

      issue.trigger({ targetID: 'camera-1' });

      expect(issue.hasIssue()).toBe(false);
    });

    it('should clear target error when media loads', () => {
      const issue = new MediaLoadIssue(createAPI());

      issue.trigger({ targetID: 'camera-1' });
      issue.detectDynamic({
        targetID: 'camera-1',
        view: 'live',
      });

      expect(issue.hasIssue()).toBe(true);

      // Media loaded clears the error for this target.
      issue.detectDynamic({
        targetID: 'camera-1',
        view: 'live',
        mediaLoadedInfo: createMediaLoadedInfo(),
      });

      // Target error was cleared by the successful load, so this unloaded state
      // falls back to the timer (issue would not activate until after the
      // timer is reached).
      issue.detectDynamic({
        targetID: 'camera-1',
        view: 'live',
      });

      expect(issue.hasIssue()).toBe(false);
    });

    it('should not activate for a different target', () => {
      const issue = new MediaLoadIssue(createAPI());

      issue.trigger({ targetID: 'camera-1' });
      issue.detectDynamic({
        targetID: 'camera-2',
        view: 'live',
      });

      // camera-2 has no error, so it falls back to timeout behavior.
      expect(issue.hasIssue()).toBe(false);
    });
  });

  describe('getNotification', () => {
    it('should return notification regardless of active state', () => {
      const issue = new MediaLoadIssue(createAPI());

      const notification = issue.getNotification();
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

    it('should include metadata for errored targets', () => {
      const issue = new MediaLoadIssue(createAPI());
      issue.trigger({ targetID: 'camera.office' });

      const notification = issue.getNotification();
      expect(notification.metadata).toEqual([
        expect.objectContaining({ text: 'camera.office', icon: 'mdi:cctv' }),
      ]);
    });

    it('should include the pending timer target in metadata', () => {
      const issue = new MediaLoadIssue(createAPI());

      // Start a load timer (no explicit error yet, just slow-loading).
      issue.detectDynamic({ targetID: 'camera.garden', view: 'live' });

      const notification = issue.getNotification();
      expect(notification.metadata).toEqual([
        expect.objectContaining({ text: 'camera.garden', icon: 'mdi:cctv' }),
      ]);
    });

    it('should use camera title when available', () => {
      const api = createAPI();
      vi.mocked(api.getCameraManager().getCameraMetadata).mockReturnValue({
        title: 'Office',
        icon: { icon: 'mdi:cctv' },
      });
      const issue = new MediaLoadIssue(api);
      issue.trigger({ targetID: 'camera.office' });

      const notification = issue.getNotification();
      expect(notification.metadata).toEqual([
        expect.objectContaining({ text: 'Office' }),
      ]);
    });

    it('should include a retry control with wired callback', async () => {
      const api = createCardAPI();
      const issue = new MediaLoadIssue(api);

      const control = issue.getNotification().controls?.[0];
      expect(control).toMatchObject({ icon: 'mdi:refresh', dismiss: true });

      const tapAction = control?.actions?.tap_action as InternalCallbackActionConfig;
      await tapAction.callback(api);

      expect(api.getIssueManager().retry).toBeCalledWith('media_load', true);
    });
  });

  describe('getIssue', () => {
    it('should return result when timed out', () => {
      const issue = new MediaLoadIssue(createAPI());

      issue.detectDynamic({ view: 'live' });
      vi.advanceTimersByTime(10000);

      const result = issue.getIssue();
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
      const issue = new MediaLoadIssue(createAPI());

      expect(issue.getIssue()).toBeNull();
    });
  });

  describe('needsRetry', () => {
    it('should return true when issue is active', () => {
      const issue = new MediaLoadIssue(createAPI());

      issue.detectDynamic({ view: 'live' });
      vi.advanceTimersByTime(10000);

      expect(issue.needsRetry()).toBe(true);
    });

    it('should return false when issue is not active', () => {
      const issue = new MediaLoadIssue(createAPI());

      expect(issue.needsRetry()).toBe(false);
    });
  });

  describe('retry', () => {
    it('should keep issue active after retry so error stays visible', () => {
      const onChange = vi.fn();
      const issue = new MediaLoadIssue(createAPI(), onChange);

      issue.detectDynamic({ view: 'live' });
      vi.advanceTimersByTime(10000);
      expect(issue.hasIssue()).toBe(true);

      issue.retry();

      // Issue remains active — no new 10s grace period. The error stays
      // visible while the provider re-attempts loading underneath.
      expect(issue.hasIssue()).toBe(true);
    });

    it('should return false when no targets have errors', () => {
      const api = createAPI();
      const issue = new MediaLoadIssue(api);

      expect(issue.retry()).toBe(false);
    });

    it('should bump mediaEpoch for targets with errors and call setViewWithMergedContext', () => {
      const api = createAPI();
      vi.mocked(api.getViewManager().getView).mockReturnValue(mock<View>());
      const issue = new MediaLoadIssue(api);

      issue.trigger({ targetID: 'camera-1' });
      issue.trigger({ targetID: 'media-1' });

      const result = issue.retry();

      expect(result).toEqual(false);
      expect(api.getViewManager().setViewWithMergedContext).toBeCalledWith({
        mediaEpoch: { 'camera-1': 1, 'media-1': 1 },
      });
    });

    it('should bump mediaEpoch for the image-view sentinel', () => {
      const api = createAPI();
      vi.mocked(api.getViewManager().getView).mockReturnValue(mock<View>());
      const issue = new MediaLoadIssue(api);

      issue.trigger({ targetID: IMAGE_VIEW_TARGET_ID_SENTINEL });

      const result = issue.retry();

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
      const issue = new MediaLoadIssue(api);

      issue.trigger({ targetID: 'camera-1' });

      const result = issue.retry();

      expect(result).toEqual(false);
      expect(api.getViewManager().setViewWithMergedContext).toBeCalledWith({
        mediaEpoch: { 'camera-1': 6, 'camera-2': 3 },
      });
    });

    it('should include pending timer target in retry', () => {
      const api = createAPI();
      vi.mocked(api.getViewManager().getView).mockReturnValue(mock<View>());
      const issue = new MediaLoadIssue(api);

      // Start the timer for camera-1 (not yet timed out).
      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });

      issue.retry();

      expect(api.getViewManager().setViewWithMergedContext).toBeCalledWith({
        mediaEpoch: { 'camera-1': 1 },
      });
    });

    it('should keep errored targets and issue state after retry', () => {
      const api = createAPI();
      vi.mocked(api.getViewManager().getView).mockReturnValue(mock<View>());
      const issue = new MediaLoadIssue(api);

      issue.trigger({ targetID: 'camera-1' });
      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });
      expect(issue.hasIssue()).toBe(true);

      issue.retry();

      // After retry, the issue stays active and the errored target is
      // preserved — no new 10s grace period. If media:loaded fires, the
      // existing _handleMediaLoaded path will clear everything.
      expect(issue.hasIssue()).toBe(true);
      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });
      expect(issue.hasIssue()).toBe(true);
    });
  });

  describe('reset', () => {
    it('should stop timer', () => {
      const onChange = vi.fn();
      const issue = new MediaLoadIssue(createAPI(), onChange);

      issue.detectDynamic({ view: 'live' });
      issue.reset();

      vi.advanceTimersByTime(10000);

      expect(issue.hasIssue()).toBe(false);
      expect(onChange).not.toBeCalled();
    });
  });
});
