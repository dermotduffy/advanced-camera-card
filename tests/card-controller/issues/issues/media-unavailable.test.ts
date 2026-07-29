import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { MediaUnavailableIssue } from '../../../../src/card-controller/issues/issues/media-unavailable';
import type { MediaLoadedInfoChange } from '../../../../src/card-controller/media-info-manager';
import type { InternalCallbackActionConfig } from '../../../../src/config/schema/actions/custom/internal';
import { IMAGE_VIEW_TARGET_ID_SENTINEL } from '../../../../src/view/target-id';
import type { View } from '../../../../src/view/view';
import { createCardAPI, createMediaLoadedInfo } from '../../../test-utils';

const createAPI = () => createCardAPI();

// Deliver a media change to the listener the issue registered with the
// media-loaded manager.
const fireMediaChange = (
  api: ReturnType<typeof createAPI>,
  change: MediaLoadedInfoChange,
): void => {
  vi.mocked(api.getMediaLoadedInfoManager().subscribe).mock.calls[0]?.[0]?.(change);
};

// Simulate a media (re)load for `targetID`.
const fireMediaLoad = (api: ReturnType<typeof createAPI>, targetID: string): void => {
  fireMediaChange(api, {
    type: 'load',
    targetID,
    info: createMediaLoadedInfo({ targetID }),
  });
};

// @vitest-environment jsdom
describe('MediaUnavailableIssue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should have correct key', () => {
    const issue = new MediaUnavailableIssue(createAPI());
    expect(issue.key).toBe('media_unavailable');
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
      const issue = new MediaUnavailableIssue(createAPI(), onChange);

      issue.detectDynamic({ targetID: 'target-1', view });

      expect(issue.hasIssue()).toBe(false);

      vi.advanceTimersByTime(10000);

      expect(issue.hasIssue()).toBe(true);
      expect(onChange).toHaveBeenCalled();
    });

    it('should not start timer when targetID is null (no provider rendering)', () => {
      const issue = new MediaUnavailableIssue(createAPI());

      // Media view but no targetID, e.g. viewer showing "No media to display"
      // instead of mounting a provider.
      issue.detectDynamic({ view: 'media' });

      vi.advanceTimersByTime(10000);

      expect(issue.hasIssue()).toBe(false);
    });

    it('should deactivate when targetID becomes null', () => {
      const issue = new MediaUnavailableIssue(createAPI());

      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });
      vi.advanceTimersByTime(10000);
      expect(issue.hasIssue()).toBe(true);

      // Target cleared (e.g. switched to a view with no media provider).
      issue.detectDynamic({ view: 'live' });
      expect(issue.hasIssue()).toBe(false);
    });

    it('should not start timer when view is not a media view', () => {
      const issue = new MediaUnavailableIssue(createAPI());

      issue.detectDynamic({ view: 'timeline' });

      vi.advanceTimersByTime(10000);

      expect(issue.hasIssue()).toBe(false);
    });

    it('should not start timer when view is undefined', () => {
      const issue = new MediaUnavailableIssue(createAPI());

      issue.detectDynamic({});

      vi.advanceTimersByTime(10000);

      expect(issue.hasIssue()).toBe(false);
    });

    it('should not start timer when media is loaded', () => {
      const issue = new MediaUnavailableIssue(createAPI());

      issue.detectDynamic({ view: 'live', mediaLoadedInfo: createMediaLoadedInfo() });

      vi.advanceTimersByTime(10000);

      expect(issue.hasIssue()).toBe(false);
    });

    it('should clear timeout when media loads', () => {
      const issue = new MediaUnavailableIssue(createAPI());

      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });
      vi.advanceTimersByTime(5000);

      issue.detectDynamic({ view: 'live', mediaLoadedInfo: createMediaLoadedInfo() });

      vi.advanceTimersByTime(5000);

      expect(issue.hasIssue()).toBe(false);
    });

    it('should clear timeout when view changes to a non-media view', () => {
      const issue = new MediaUnavailableIssue(createAPI());

      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });
      vi.advanceTimersByTime(5000);

      issue.detectDynamic({ view: 'timeline' });

      vi.advanceTimersByTime(5000);

      expect(issue.hasIssue()).toBe(false);
    });

    it('should remain active across media views for the same target', () => {
      const issue = new MediaUnavailableIssue(createAPI());

      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });
      vi.advanceTimersByTime(10000);
      expect(issue.hasIssue()).toBe(true);

      // Same target, different media view -- issue stays active.
      issue.detectDynamic({ targetID: 'camera-1', view: 'clip' });
      expect(issue.hasIssue()).toBe(true);
    });

    it('should deactivate when target changes to non-errored target', () => {
      const issue = new MediaUnavailableIssue(createAPI());

      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });
      vi.advanceTimersByTime(10000);
      expect(issue.hasIssue()).toBe(true);

      // Switch to camera-2 which has no error -- should deactivate and start
      // a fresh timer for the new target.
      issue.detectDynamic({ targetID: 'camera-2', view: 'live' });
      expect(issue.hasIssue()).toBe(false);

      // camera-2 gets its own timeout window.
      vi.advanceTimersByTime(10000);
      expect(issue.hasIssue()).toBe(true);
    });

    it('should stay active when target changes to errored target', () => {
      const issue = new MediaUnavailableIssue(createAPI());

      issue.trigger({ targetID: 'camera-1', reason: 'stalled' });
      issue.trigger({ targetID: 'camera-2', reason: 'stalled' });

      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });
      expect(issue.hasIssue()).toBe(true);

      // Switch to camera-2 which also has an error -- should stay active.
      issue.detectDynamic({ targetID: 'camera-2', view: 'live' });
      expect(issue.hasIssue()).toBe(true);
    });

    it('should clear timed-out state when media loads', () => {
      const issue = new MediaUnavailableIssue(createAPI());

      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });
      vi.advanceTimersByTime(10000);
      expect(issue.hasIssue()).toBe(true);

      issue.detectDynamic({ view: 'live', mediaLoadedInfo: createMediaLoadedInfo() });
      expect(issue.hasIssue()).toBe(false);
    });

    it('should restart timer when target changes', () => {
      const onChange = vi.fn();
      const issue = new MediaUnavailableIssue(createAPI(), onChange);

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
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('should not restart timer for same target while running', () => {
      const onChange = vi.fn();
      const issue = new MediaUnavailableIssue(createAPI(), onChange);

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
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('should not restart timer when targetID is undefined and matches', () => {
      const onChange = vi.fn();
      const issue = new MediaUnavailableIssue(createAPI(), onChange);

      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });
      vi.advanceTimersByTime(5000);

      // Same undefined target: timer should continue.
      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });

      vi.advanceTimersByTime(5000);
      expect(issue.hasIssue()).toBe(true);
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('should not restart timer if already timed out', () => {
      const onChange = vi.fn();
      const issue = new MediaUnavailableIssue(createAPI(), onChange);

      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });
      vi.advanceTimersByTime(10000);
      expect(onChange).toHaveBeenCalledTimes(1);

      // Calling detectDynamic again should not restart timer.
      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });
      vi.advanceTimersByTime(10000);
      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('trigger', () => {
    it('should activate immediately when target has error and view is a media view', () => {
      const issue = new MediaUnavailableIssue(createAPI());

      issue.trigger({ targetID: 'camera-1', reason: 'stalled' });
      issue.detectDynamic({
        targetID: 'camera-1',
        view: 'live',
      });

      expect(issue.hasIssue()).toBe(true);
    });

    it('should not activate with only a trigger', () => {
      const issue = new MediaUnavailableIssue(createAPI());

      issue.trigger({ targetID: 'camera-1', reason: 'stalled' });

      expect(issue.hasIssue()).toBe(false);
    });

    it('should clear a not-loading error on a media load', () => {
      const api = createAPI();
      const issue = new MediaUnavailableIssue(api);

      issue.trigger({ targetID: 'camera-1', reason: 'not_loading' });
      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });
      expect(issue.hasIssue()).toBe(true);

      // An attached player disproves "media not loading", whoever recorded it.
      fireMediaLoad(api, 'camera-1');

      // The error is gone, so this unloaded state falls back to the timer
      // (would not activate until the timeout).
      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });
      expect(issue.hasIssue()).toBe(false);
    });

    it('should not clear a stream error on a media load', () => {
      const api = createAPI();
      const issue = new MediaUnavailableIssue(api);

      issue.trigger({ targetID: 'camera-1', reason: 'stalled' });

      // A load only says a player attached -- for a stream that loaded and then
      // froze, that includes a reconnect replay of the frozen player. Stream
      // errors clear only via resolve, on real evidence of media flowing.
      fireMediaLoad(api, 'camera-1');
      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });

      expect(issue.hasIssue()).toBe(true);
    });

    it('should keep an errored target active while its media still reads as loaded', () => {
      const issue = new MediaUnavailableIssue(createAPI());

      issue.trigger({ targetID: 'camera-1', reason: 'stalled' });

      // The (now frozen) media still reads as loaded, but the existing loaded
      // level must not clear the error -- only a genuine media load does. The
      // loaded media is the frozen stream a liveness detector just condemned.
      issue.detectDynamic({
        targetID: 'camera-1',
        view: 'live',
        mediaLoadedInfo: createMediaLoadedInfo({ targetID: 'camera-1' }),
      });

      expect(issue.hasIssue()).toBe(true);
    });

    it('should not clear a target error when a different target loads', () => {
      const api = createAPI();
      const issue = new MediaUnavailableIssue(api);

      issue.trigger({ targetID: 'camera-1', reason: 'not_loading' });

      // A load for a different target must not clear camera-1's error.
      fireMediaLoad(api, 'camera-2');
      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });

      expect(issue.hasIssue()).toBe(true);
    });

    it('should not clear a target error on unload or select changes', () => {
      const api = createAPI();
      const issue = new MediaUnavailableIssue(api);

      issue.trigger({ targetID: 'camera-1', reason: 'not_loading' });

      // Only a load clears; unload / select changes are irrelevant.
      fireMediaChange(api, { type: 'unload', targetID: 'camera-1' });
      fireMediaChange(api, { type: 'select', targetID: 'camera-1' });
      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });

      expect(issue.hasIssue()).toBe(true);
    });

    it('should not activate for a different target', () => {
      const issue = new MediaUnavailableIssue(createAPI());

      issue.trigger({ targetID: 'camera-1', reason: 'stalled' });
      issue.detectDynamic({
        targetID: 'camera-2',
        view: 'live',
      });

      // camera-2 has no error, so it falls back to timeout behavior.
      expect(issue.hasIssue()).toBe(false);
    });
  });

  describe('resolve', () => {
    it('should clear an errored target', () => {
      const issue = new MediaUnavailableIssue(createAPI());

      issue.trigger({ targetID: 'camera.office', reason: 'stalled' });
      expect(issue.getNotification().metadata).toEqual([
        expect.objectContaining({ text: 'camera.office: Stream stalled' }),
      ]);

      issue.resolve({ targetID: 'camera.office' });

      expect(issue.getNotification().metadata).toBeUndefined();
    });

    it('should deactivate a target that is proven to be delivering media again', () => {
      const issue = new MediaUnavailableIssue(createAPI());

      issue.trigger({ targetID: 'camera-1', reason: 'stalled' });
      issue.detectDynamic({
        targetID: 'camera-1',
        view: 'live',
        mediaLoadedInfo: createMediaLoadedInfo({ targetID: 'camera-1' }),
      });
      expect(issue.hasIssue()).toBe(true);

      issue.resolve({ targetID: 'camera-1' });
      issue.detectDynamic({
        targetID: 'camera-1',
        view: 'live',
        mediaLoadedInfo: createMediaLoadedInfo({ targetID: 'camera-1' }),
      });

      expect(issue.hasIssue()).toBe(false);
    });

    it('should leave other targets errored', () => {
      const issue = new MediaUnavailableIssue(createAPI());

      issue.trigger({ targetID: 'camera.office', reason: 'stalled' });

      issue.resolve({ targetID: 'camera.garden' });

      expect(issue.getNotification().metadata).toEqual([
        expect.objectContaining({ text: 'camera.office: Stream stalled' }),
      ]);
    });

    it('should cancel the pending-load timer for its target', () => {
      const onChange = vi.fn();
      const issue = new MediaUnavailableIssue(createAPI(), onChange);

      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });

      issue.resolve({ targetID: 'camera-1' });

      vi.advanceTimersByTime(10000);
      expect(issue.hasIssue()).toBe(false);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('should leave the pending-load timer alone for a different target', () => {
      const issue = new MediaUnavailableIssue(createAPI());

      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });

      issue.resolve({ targetID: 'camera-2' });

      vi.advanceTimersByTime(10000);
      expect(issue.hasIssue()).toBe(true);
    });
  });

  describe('getNotification', () => {
    it('should return notification regardless of active state', () => {
      const issue = new MediaUnavailableIssue(createAPI());

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

    it('should include the pending timer target in metadata', () => {
      const issue = new MediaUnavailableIssue(createAPI());

      // Start a load timer (no explicit error yet, just slow-loading).
      issue.detectDynamic({ targetID: 'camera.garden', view: 'live' });

      const notification = issue.getNotification();
      expect(notification.metadata).toEqual([
        expect.objectContaining({
          text: 'camera.garden: Media not loading',
          icon: 'mdi:progress-helper',
        }),
      ]);
    });

    it('should drop a stale pending-timer target once its timer has stopped', () => {
      const issue = new MediaUnavailableIssue(createAPI());

      // A slow load arms the pending timer for camera.garden.
      issue.detectDynamic({ targetID: 'camera.garden', view: 'live' });

      // The view moves to a different target that already has a hard error.
      // That path activates immediately and stops the timer, but the stale
      // _timerTargetID (camera.garden) lingers.
      issue.trigger({ targetID: 'camera.office', reason: 'playback_error' });
      issue.detectDynamic({ targetID: 'camera.office', view: 'live' });

      // Only the real error shows; the stale, no-longer-running pending target
      // must not paint a "not loading" line.
      const notification = issue.getNotification();
      expect(notification.metadata).not.toContainEqual(
        expect.objectContaining({ text: 'camera.garden: Media not loading' }),
      );
      expect(notification.metadata).toEqual([
        expect.objectContaining({ text: 'camera.office: Playback error' }),
      ]);
    });

    it('should use camera title when available', () => {
      const api = createAPI();
      vi.mocked(api.getCameraManager().getCameraMetadata).mockReturnValue({
        title: 'Office',
        icon: { icon: 'mdi:cctv' },
      });
      const issue = new MediaUnavailableIssue(api);
      issue.trigger({ targetID: 'camera.office', reason: 'stalled' });

      const notification = issue.getNotification();
      expect(notification.metadata).toEqual([
        expect.objectContaining({ text: 'Office: Stream stalled' }),
      ]);
    });

    it('should use localized label and image icon for the image-view sentinel', () => {
      const issue = new MediaUnavailableIssue(createAPI());
      issue.trigger({ targetID: IMAGE_VIEW_TARGET_ID_SENTINEL, reason: 'stalled' });

      const notification = issue.getNotification();
      expect(notification.metadata).toEqual([
        expect.objectContaining({ text: 'Image: Stream stalled', icon: 'mdi:image' }),
      ]);
    });

    it.each([
      ['entity_unavailable' as const, 'Camera entity unavailable', 'mdi:cctv-off'],
      ['not_loading' as const, 'Media not loading', 'mdi:progress-helper'],
      ['playback_error' as const, 'Playback error', 'mdi:alert-circle'],
      ['stalled' as const, 'Stream stalled', 'mdi:motion-pause'],
    ])('should give the %s cause its own text and icon', (reason, text, icon) => {
      const issue = new MediaUnavailableIssue(createAPI());
      issue.trigger({ targetID: 'camera.office', reason });

      const notification = issue.getNotification();
      expect(notification.metadata).toEqual([
        expect.objectContaining({ text: `camera.office: ${text}`, icon }),
      ]);
    });

    it('should render the free-text cause as context, keyed by camera title', () => {
      const api = createAPI();
      vi.mocked(api.getCameraManager().getCameraMetadata).mockReturnValue({
        title: 'Office',
        icon: { icon: 'mdi:cctv' },
      });
      const issue = new MediaUnavailableIssue(api);
      issue.trigger({
        targetID: 'camera.office',
        reason: 'playback_error',
        description: 'Failed to start WebRTC stream: no candidates',
      });

      const notification = issue.getNotification();

      // The metadata line stays scannable; the long cause sits below it.
      expect(notification.metadata).toEqual([
        expect.objectContaining({ text: 'Office: Playback error' }),
      ]);
      expect(notification.context).toEqual([
        'Office: Failed to start WebRTC stream: no candidates',
      ]);
    });

    it('should omit context for targets without a free-text cause', () => {
      const issue = new MediaUnavailableIssue(createAPI());
      issue.trigger({ targetID: 'camera.office', reason: 'stalled' });

      expect(issue.getNotification().context).toBeUndefined();
    });

    it('should include a retry control with wired callback', async () => {
      const api = createCardAPI();
      const issue = new MediaUnavailableIssue(api);

      const control = issue.getNotification().controls?.[0];
      expect(control).toMatchObject({ icon: 'mdi:refresh', dismiss: true });

      const tapAction = control?.actions?.tap_action as InternalCallbackActionConfig;
      await tapAction.callback(api);

      expect(api.getIssueManager().retry).toHaveBeenCalledWith(
        'media_unavailable',
        true,
      );
    });
  });

  describe('getIssue', () => {
    it('should return result when timed out', () => {
      const issue = new MediaUnavailableIssue(createAPI());

      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });
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
      const issue = new MediaUnavailableIssue(createAPI());

      expect(issue.getIssue()).toBeNull();
    });
  });

  describe('needsRetry', () => {
    it('should return true when issue is active', () => {
      const issue = new MediaUnavailableIssue(createAPI());

      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });
      vi.advanceTimersByTime(10000);

      expect(issue.needsRetry()).toBe(true);
    });

    it('should return false when issue is not active', () => {
      const issue = new MediaUnavailableIssue(createAPI());

      expect(issue.needsRetry()).toBe(false);
    });
  });

  describe('retry', () => {
    it('should keep issue active after retry so error stays visible', () => {
      const onChange = vi.fn();
      const issue = new MediaUnavailableIssue(createAPI(), onChange);

      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });
      vi.advanceTimersByTime(10000);
      expect(issue.hasIssue()).toBe(true);

      issue.retry();

      // Issue remains active -- no new 10s grace period. The error stays
      // visible while the provider re-attempts loading underneath.
      expect(issue.hasIssue()).toBe(true);
    });

    it('should return false when no targets have errors', () => {
      const api = createAPI();
      const issue = new MediaUnavailableIssue(api);

      expect(issue.retry()).toBe(false);
    });

    it('should bump mediaEpoch for targets with errors and call setViewWithMergedContext', () => {
      const api = createAPI();
      vi.mocked(api.getViewManager().getView).mockReturnValue(mock<View>());
      const issue = new MediaUnavailableIssue(api);

      issue.trigger({ targetID: 'camera-1', reason: 'stalled' });
      issue.trigger({ targetID: 'media-1', reason: 'stalled' });

      const result = issue.retry();

      expect(result).toEqual(false);
      expect(api.getViewManager().setViewWithMergedContext).toHaveBeenCalledWith({
        mediaEpoch: { 'camera-1': 1, 'media-1': 1 },
      });
    });

    it('should bump mediaEpoch for the image-view sentinel', () => {
      const api = createAPI();
      vi.mocked(api.getViewManager().getView).mockReturnValue(mock<View>());
      const issue = new MediaUnavailableIssue(api);

      issue.trigger({ targetID: IMAGE_VIEW_TARGET_ID_SENTINEL, reason: 'stalled' });

      const result = issue.retry();

      expect(result).toEqual(false);
      expect(api.getViewManager().setViewWithMergedContext).toHaveBeenCalledWith({
        mediaEpoch: { [IMAGE_VIEW_TARGET_ID_SENTINEL]: 1 },
      });
    });

    it('should increment existing epoch values from current view context', () => {
      const api = createAPI();
      vi.mocked(api.getViewManager().getView).mockReturnValue(
        mock<View>({ context: { mediaEpoch: { 'camera-1': 5, 'camera-2': 3 } } }),
      );
      const issue = new MediaUnavailableIssue(api);

      issue.trigger({ targetID: 'camera-1', reason: 'stalled' });

      const result = issue.retry();

      expect(result).toEqual(false);
      expect(api.getViewManager().setViewWithMergedContext).toHaveBeenCalledWith({
        mediaEpoch: { 'camera-1': 6, 'camera-2': 3 },
      });
    });

    it('should include pending timer target in retry', () => {
      const api = createAPI();
      vi.mocked(api.getViewManager().getView).mockReturnValue(mock<View>());
      const issue = new MediaUnavailableIssue(api);

      // Start the timer for camera-1 (not yet timed out).
      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });

      issue.retry();

      expect(api.getViewManager().setViewWithMergedContext).toHaveBeenCalledWith({
        mediaEpoch: { 'camera-1': 1 },
      });
    });

    it('should not retry a stale pending-timer target once its timer has stopped', () => {
      const api = createAPI();
      vi.mocked(api.getViewManager().getView).mockReturnValue(mock<View>());
      const issue = new MediaUnavailableIssue(api);

      // A slow load arms the pending timer for camera.garden.
      issue.detectDynamic({ targetID: 'camera.garden', view: 'live' });

      // The view moves to a target that already has a hard error. That path
      // activates immediately and stops the timer, but the stale
      // _timerTargetID (camera.garden) lingers -- and that target may since
      // have loaded, so reloading it would be gratuitous.
      issue.trigger({ targetID: 'camera.office', reason: 'playback_error' });
      issue.detectDynamic({ targetID: 'camera.office', view: 'live' });

      issue.retry();

      expect(api.getViewManager().setViewWithMergedContext).toHaveBeenCalledWith({
        mediaEpoch: { 'camera.office': 1 },
      });
    });

    it('should keep errored targets and issue state after retry', () => {
      const api = createAPI();
      vi.mocked(api.getViewManager().getView).mockReturnValue(mock<View>());
      const issue = new MediaUnavailableIssue(api);

      issue.trigger({ targetID: 'camera-1', reason: 'stalled' });
      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });
      expect(issue.hasIssue()).toBe(true);

      issue.retry();

      // After retry, the issue stays active and the errored target is preserved
      // -- no new 10s grace period. Recovery clears it: a load for a
      // not-loading error, a resolve for a stream error.
      expect(issue.hasIssue()).toBe(true);
      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });
      expect(issue.hasIssue()).toBe(true);
    });
  });

  describe('reset', () => {
    it('should stop timer', () => {
      const onChange = vi.fn();
      const issue = new MediaUnavailableIssue(createAPI(), onChange);

      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });
      issue.reset();

      vi.advanceTimersByTime(10000);

      expect(issue.hasIssue()).toBe(false);
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('media loads', () => {
    it('should notify onChange when a media load clears an error', () => {
      const api = createAPI();
      const onChange = vi.fn();
      const issue = new MediaUnavailableIssue(api, onChange);

      issue.trigger({ targetID: 'camera-1', reason: 'not_loading' });
      fireMediaLoad(api, 'camera-1');

      expect(onChange).toHaveBeenCalled();
    });

    it('should not notify onChange when a load changes nothing', () => {
      const api = createAPI();
      const onChange = vi.fn();
      const issue = new MediaUnavailableIssue(api, onChange);

      issue.trigger({ targetID: 'camera-1', reason: 'stalled' });
      fireMediaLoad(api, 'camera-1');

      expect(onChange).not.toHaveBeenCalled();
    });

    it('should clear a timer-recorded error when the media later loads', () => {
      const api = createAPI();
      const issue = new MediaUnavailableIssue(api);

      // A viewer target has no liveness observer, so a load is the only
      // recovery signal it will ever produce.
      issue.detectDynamic({ targetID: 'media-1', view: 'clip' });
      vi.advanceTimersByTime(10000);
      expect(issue.getNotification().metadata).toEqual([
        expect.objectContaining({ text: 'media-1: Media not loading' }),
      ]);

      fireMediaLoad(api, 'media-1');

      expect(issue.getNotification().metadata).toBeUndefined();
      issue.detectDynamic({
        targetID: 'media-1',
        view: 'clip',
        mediaLoadedInfo: createMediaLoadedInfo({ targetID: 'media-1' }),
      });
      expect(issue.hasIssue()).toBe(false);
    });

    it('should cancel the pending-load timer when its target genuinely loads', () => {
      const api = createAPI();
      const issue = new MediaUnavailableIssue(api);

      // A target starts loading, arming the pending-load timer.
      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });

      // It loads in the background, so no further detection pass runs for it
      // (detection only ever covers the current target).
      fireMediaLoad(api, 'camera-1');

      vi.advanceTimersByTime(10000);

      expect(issue.hasIssue()).toBe(false);
      expect(issue.getNotification().metadata).toBeUndefined();
    });

    it('should unsubscribe from media loads on destroy', () => {
      const api = createAPI();
      const unsubscribe = vi.fn();
      vi.mocked(api.getMediaLoadedInfoManager().subscribe).mockReturnValue(unsubscribe);
      const issue = new MediaUnavailableIssue(api);

      issue.destroy();

      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe('suspend', () => {
    it('should stop the pending-load timer so it cannot mature offscreen', () => {
      const onChange = vi.fn();
      const issue = new MediaUnavailableIssue(createAPI(), onChange);

      // Enter loading state. Timer arms but has not yet fired.
      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });
      vi.advanceTimersByTime(5000);
      expect(issue.hasIssue()).toBe(false);

      // Card detaches: timer must stop.
      issue.suspend();

      // Full 10s later (plus margin) the timer has NOT matured -- the user was
      // offscreen and that time does not count against them.
      vi.advanceTimersByTime(20000);
      expect(issue.hasIssue()).toBe(false);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('should preserve an already-active issue across suspend', () => {
      const issue = new MediaUnavailableIssue(createAPI());

      // Issue activates (timeout fires).
      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });
      vi.advanceTimersByTime(10000);
      expect(issue.hasIssue()).toBe(true);

      // Card detaches -- issue must remain visible on reattach.
      issue.suspend();

      expect(issue.hasIssue()).toBe(true);
    });

    it('should rearm a fresh timer window on resume via detectDynamic', () => {
      const onChange = vi.fn();
      const issue = new MediaUnavailableIssue(createAPI(), onChange);

      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });
      vi.advanceTimersByTime(5000);
      issue.suspend();

      // Reattach: the manager's resume() triggers evaluate() → detectDynamic.
      // The target is still loading, so the timer arms with a fresh 10s window
      // -- not whatever was left when we suspended.
      issue.detectDynamic({ targetID: 'camera-1', view: 'live' });

      vi.advanceTimersByTime(9999);
      expect(issue.hasIssue()).toBe(false);
      vi.advanceTimersByTime(1);
      expect(issue.hasIssue()).toBe(true);
      expect(onChange).toHaveBeenCalled();
    });
  });
});
