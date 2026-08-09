import { describe, expect, it, vi } from 'vitest';

import type { CardController } from '../../../../src/card-controller/controller';
import { MediaUnavailableIssue } from '../../../../src/card-controller/issues/issues/media-unavailable';
import type { InternalCallbackActionConfig } from '../../../../src/config/schema/actions/custom/internal';
import { IMAGE_VIEW_TARGET_ID_SENTINEL } from '../../../../src/view/target-id';
import type { View } from '../../../../src/view/view';
import {
  createCameraManager,
  createCapabilities,
  createStore,
} from '../../../camera-manager/test-utils';
import { createCardAPI } from '../../../test-utils';
import { createView } from '../../../view/test-utils';

const createAPIWithView = (view: View | null): CardController => {
  const api = createCardAPI();
  vi.mocked(api.getViewManager().getView).mockReturnValue(view);
  return api;
};

const createAPIDisplaying = (...cameraIDs: string[]): CardController => {
  const api = createAPIWithView(
    createView({ view: 'live', camera: cameraIDs[0], displayMode: 'grid' }),
  );

  vi.mocked(api.getCameraManager).mockReturnValue(
    createCameraManager(
      createStore(
        cameraIDs.map((cameraID) => ({
          cameraID,
          capabilities: createCapabilities({ live: true }),
        })),
      ),
    ),
  );

  return api;
};

// @vitest-environment jsdom
describe('MediaUnavailableIssue', () => {
  it('should have correct key', () => {
    expect(new MediaUnavailableIssue(createCardAPI()).key).toBe('media_unavailable');
  });

  describe('activation', () => {
    it('should activate for a displayed target that has failed', () => {
      const issue = new MediaUnavailableIssue(createAPIDisplaying('camera-1'));

      issue.trigger({ targetID: 'camera-1', reason: 'stalled' });

      expect(issue.hasIssue()).toBe(true);
    });

    it('should not activate without any failure', () => {
      expect(new MediaUnavailableIssue(createAPIDisplaying('camera-1')).hasIssue()).toBe(
        false,
      );
    });

    it('should activate for a failed target that is not the selected one', () => {
      const issue = new MediaUnavailableIssue(
        createAPIDisplaying('camera-1', 'camera-2'),
      );

      // Every camera of a grid is on screen, so a failure in any of them is
      // the user's to see and the card's to reload.
      // See: https://github.com/dermotduffy/advanced-camera-card/issues/2637
      issue.trigger({ targetID: 'camera-2', reason: 'server_error' });

      expect(issue.hasIssue()).toBe(true);
      expect(issue.needsRetry()).toBe(true);
    });

    it('should not activate for a failed target that is not displayed', () => {
      const issue = new MediaUnavailableIssue(createAPIDisplaying('camera-1'));

      issue.trigger({ targetID: 'camera-2', reason: 'server_error' });

      expect(issue.hasIssue()).toBe(false);
    });

    it('should not activate in a view that shows no media', () => {
      const issue = new MediaUnavailableIssue(
        createAPIWithView(createView({ view: 'timeline' })),
      );

      issue.trigger({ targetID: 'camera-1', reason: 'stalled' });

      expect(issue.hasIssue()).toBe(false);
    });

    it('should not activate without a view', () => {
      const issue = new MediaUnavailableIssue(createAPIWithView(null));

      issue.trigger({ targetID: 'camera-1', reason: 'stalled' });

      expect(issue.hasIssue()).toBe(false);
    });

    it('should deactivate once the view moves off the failed target', () => {
      const api = createAPIDisplaying('camera-1');
      const issue = new MediaUnavailableIssue(api);

      issue.trigger({ targetID: 'camera-1', reason: 'stalled' });
      expect(issue.hasIssue()).toBe(true);

      vi.mocked(api.getViewManager().getView).mockReturnValue(
        createView({ view: 'live', camera: 'camera-2' }),
      );

      expect(issue.hasIssue()).toBe(false);
    });

    it('should activate for a camera that arrives after the failure', () => {
      const api = createAPIDisplaying('camera-1');
      const issue = new MediaUnavailableIssue(api);

      issue.trigger({ targetID: 'camera-2', reason: 'stalled' });
      expect(issue.hasIssue()).toBe(false);

      // Which cameras a view lays out depends on the cameras that exist, so it
      // can change without the view itself changing.
      vi.mocked(api.getCameraManager).mockReturnValue(
        createCameraManager(
          createStore(
            ['camera-1', 'camera-2'].map((cameraID) => ({
              cameraID,
              capabilities: createCapabilities({ live: true }),
            })),
          ),
        ),
      );

      expect(issue.hasIssue()).toBe(true);
    });
  });

  describe('naming the failures', () => {
    it('should report every failed target that is on screen', () => {
      const issue = new MediaUnavailableIssue(
        createAPIDisplaying('camera-1', 'camera-2'),
      );

      issue.trigger({ targetID: 'camera-1', reason: 'stalled' });
      issue.trigger({ targetID: 'camera-2', reason: 'playback_error' });

      expect(issue.getNotification().metadata).toEqual([
        expect.objectContaining({ text: 'camera-1: Stream stalled' }),
        expect.objectContaining({ text: 'camera-2: Playback error' }),
      ]);
    });

    it('should not name a failed target that has left the screen', () => {
      const issue = new MediaUnavailableIssue(createAPIDisplaying('camera-1'));

      issue.trigger({ targetID: 'camera-1', reason: 'stalled' });
      issue.trigger({ targetID: 'camera-2', reason: 'playback_error' });

      expect(issue.getNotification().metadata).toEqual([
        expect.objectContaining({ text: 'camera-1: Stream stalled' }),
      ]);
    });

    it('should not reload a failed target that has left the screen', () => {
      const api = createAPIDisplaying('camera-1');
      const issue = new MediaUnavailableIssue(api);

      issue.trigger({ targetID: 'camera-1', reason: 'stalled' });
      issue.trigger({ targetID: 'camera-2', reason: 'stalled' });

      issue.retry();

      expect(api.getViewManager().setViewWithMergedContext).toHaveBeenCalledWith({
        mediaEpoch: { 'camera-1': 1 },
      });
    });
  });

  describe('resolve', () => {
    it('should clear a failure when no reason is named', () => {
      const issue = new MediaUnavailableIssue(createAPIDisplaying('camera-1'));

      issue.trigger({ targetID: 'camera-1', reason: 'stalled' });
      issue.resolve({ targetID: 'camera-1' });

      expect(issue.hasIssue()).toBe(false);
      expect(issue.getNotification().metadata).toBeUndefined();
    });

    it('should clear a failure whose reason matches', () => {
      const issue = new MediaUnavailableIssue(createAPIDisplaying('camera-1'));

      issue.trigger({ targetID: 'camera-1', reason: 'not_loading' });
      issue.resolve({ targetID: 'camera-1', reason: 'not_loading' });

      expect(issue.hasIssue()).toBe(false);
    });

    it('should leave a failure of a different reason alone', () => {
      const issue = new MediaUnavailableIssue(createAPIDisplaying('camera-1'));

      // Media arriving refutes a load that never arrived, but says nothing
      // about a stall the same media developed since.
      issue.trigger({ targetID: 'camera-1', reason: 'stalled' });
      issue.resolve({ targetID: 'camera-1', reason: 'not_loading' });

      expect(issue.hasIssue()).toBe(true);
      expect(issue.getNotification().metadata).toEqual([
        expect.objectContaining({ text: 'camera-1: Stream stalled' }),
      ]);
    });

    it('should leave other targets alone', () => {
      const issue = new MediaUnavailableIssue(createAPIDisplaying('camera-1'));

      issue.trigger({ targetID: 'camera-1', reason: 'stalled' });
      issue.resolve({ targetID: 'camera-2' });

      expect(issue.getNotification().metadata).toEqual([
        expect.objectContaining({ text: 'camera-1: Stream stalled' }),
      ]);
    });

    it('should do nothing for a target that never failed', () => {
      const issue = new MediaUnavailableIssue(createAPIDisplaying('camera-1'));

      issue.resolve({ targetID: 'camera-1' });

      expect(issue.hasIssue()).toBe(false);
    });

    it('should do nothing for a load on a target that never failed', () => {
      const issue = new MediaUnavailableIssue(createAPIDisplaying('camera-1'));

      issue.resolve({ targetID: 'camera-1', cause: 'media-loaded' });

      expect(issue.hasIssue()).toBe(false);
    });

    describe('when the media loads', () => {
      it.each([
        ['entity_unavailable' as const, false],
        ['not_loading' as const, true],
        ['playback_error' as const, false],
        ['server_error' as const, true],
        ['stalled' as const, false],
        ['unsupported' as const, true],
      ])('should reset a %s failure: %s', (reason, cleared) => {
        const issue = new MediaUnavailableIssue(createAPIDisplaying('camera-1'));

        issue.trigger({ targetID: 'camera-1', reason });
        issue.resolve({ targetID: 'camera-1', cause: 'media-loaded' });

        expect(issue.hasIssue()).toBe(!cleared);
      });
    });
  });

  describe('trigger', () => {
    it('should replace an earlier failure for the same target', () => {
      const issue = new MediaUnavailableIssue(createAPIDisplaying('camera-1'));

      // A later, more specific diagnosis supersedes an earlier one.
      issue.trigger({ targetID: 'camera-1', reason: 'not_loading' });
      issue.trigger({ targetID: 'camera-1', reason: 'stalled' });

      expect(issue.getNotification().metadata).toEqual([
        expect.objectContaining({ text: 'camera-1: Stream stalled' }),
      ]);
    });
  });

  describe('getIssue', () => {
    it('should describe the issue when active', () => {
      const issue = new MediaUnavailableIssue(createAPIDisplaying('camera-1'));

      issue.trigger({ targetID: 'camera-1', reason: 'stalled' });

      expect(issue.getIssue()).toEqual(
        expect.objectContaining({
          icon: 'mdi:cctv-off',
          severity: 'high',
          notification: expect.objectContaining({
            heading: expect.objectContaining({ text: expect.any(String) }),
          }),
        }),
      );
    });

    it('should return null when not active', () => {
      expect(
        new MediaUnavailableIssue(createAPIDisplaying('camera-1')).getIssue(),
      ).toBeNull();
    });
  });

  describe('getNotification', () => {
    it('should return a notification regardless of active state', () => {
      const issue = new MediaUnavailableIssue(createAPIDisplaying('camera-1'));

      expect(issue.getNotification()).toEqual(
        expect.objectContaining({
          heading: expect.objectContaining({ text: expect.any(String) }),
          link: expect.objectContaining({ url: expect.any(String) }),
        }),
      );
    });

    it('should use the camera title when available', () => {
      const api = createAPIDisplaying('camera.office');
      vi.mocked(api.getCameraManager().getCameraMetadata).mockReturnValue({
        title: 'Office',
        icon: { icon: 'mdi:cctv' },
      });
      const issue = new MediaUnavailableIssue(api);

      issue.trigger({ targetID: 'camera.office', reason: 'stalled' });

      expect(issue.getNotification().metadata).toEqual([
        expect.objectContaining({ text: 'Office: Stream stalled' }),
      ]);
    });

    it('should use a localized label and image icon for the image-view sentinel', () => {
      const issue = new MediaUnavailableIssue(
        createAPIWithView(createView({ view: 'image' })),
      );

      issue.trigger({ targetID: IMAGE_VIEW_TARGET_ID_SENTINEL, reason: 'stalled' });

      expect(issue.getNotification().metadata).toEqual([
        expect.objectContaining({ text: 'Image: Stream stalled', icon: 'mdi:image' }),
      ]);
    });

    it.each([
      ['entity_unavailable' as const, 'Camera entity unavailable', 'mdi:cctv-off'],
      ['not_loading' as const, 'Media not loading', 'mdi:progress-helper'],
      ['playback_error' as const, 'Playback error', 'mdi:alert-circle'],
      ['server_error' as const, 'Streaming server error', 'mdi:server-network-off'],
      ['stalled' as const, 'Stream stalled', 'mdi:motion-pause'],
      ['unsupported' as const, 'Stream not supported', 'mdi:video-off-outline'],
    ])('should give the %s cause its own text and icon', (reason, text, icon) => {
      const issue = new MediaUnavailableIssue(createAPIDisplaying('camera.office'));

      issue.trigger({ targetID: 'camera.office', reason });

      expect(issue.getNotification().metadata).toEqual([
        expect.objectContaining({ text: `camera.office: ${text}`, icon }),
      ]);
    });

    it('should render the free-text cause as context, keyed by camera title', () => {
      const api = createAPIDisplaying('camera.office');
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
      const issue = new MediaUnavailableIssue(createAPIDisplaying('camera.office'));

      issue.trigger({ targetID: 'camera.office', reason: 'stalled' });

      expect(issue.getNotification().context).toBeUndefined();
    });

    it('should include a retry control with a wired callback', async () => {
      const api = createAPIDisplaying('camera-1');
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

  describe('needsRetry', () => {
    it('should be true while active', () => {
      const issue = new MediaUnavailableIssue(createAPIDisplaying('camera-1'));

      issue.trigger({ targetID: 'camera-1', reason: 'stalled' });

      expect(issue.needsRetry()).toBe(true);
    });

    it('should be false while not active', () => {
      expect(
        new MediaUnavailableIssue(createAPIDisplaying('camera-1')).needsRetry(),
      ).toBe(false);
    });
  });

  describe('retry', () => {
    it('should reload every failed target on screen', () => {
      const api = createAPIDisplaying('camera-1', 'camera-2');
      const issue = new MediaUnavailableIssue(api);

      issue.trigger({ targetID: 'camera-1', reason: 'stalled' });
      issue.trigger({ targetID: 'camera-2', reason: 'stalled' });

      expect(issue.retry()).toBe(false);
      expect(api.getViewManager().setViewWithMergedContext).toHaveBeenCalledWith({
        mediaEpoch: { 'camera-1': 1, 'camera-2': 1 },
      });
    });

    it('should reload the image view', () => {
      const api = createAPIWithView(createView({ view: 'image' }));
      const issue = new MediaUnavailableIssue(api);

      issue.trigger({ targetID: IMAGE_VIEW_TARGET_ID_SENTINEL, reason: 'stalled' });

      issue.retry();

      expect(api.getViewManager().setViewWithMergedContext).toHaveBeenCalledWith({
        mediaEpoch: { [IMAGE_VIEW_TARGET_ID_SENTINEL]: 1 },
      });
    });

    it('should increment the epochs already in the view context', () => {
      const api = createAPIWithView(
        createView({
          view: 'live',
          camera: 'camera-1',
          context: { mediaEpoch: { 'camera-1': 5, 'camera-2': 3 } },
        }),
      );
      const issue = new MediaUnavailableIssue(api);

      issue.trigger({ targetID: 'camera-1', reason: 'stalled' });

      issue.retry();

      expect(api.getViewManager().setViewWithMergedContext).toHaveBeenCalledWith({
        mediaEpoch: { 'camera-1': 6, 'camera-2': 3 },
      });
    });

    it('should do nothing when nothing on screen has failed', () => {
      const api = createAPIDisplaying('camera-1');
      const issue = new MediaUnavailableIssue(api);

      expect(issue.retry()).toBe(false);
      expect(api.getViewManager().setViewWithMergedContext).not.toHaveBeenCalled();
    });

    it('should keep the failure visible while the reload is attempted', () => {
      const issue = new MediaUnavailableIssue(createAPIDisplaying('camera-1'));

      issue.trigger({ targetID: 'camera-1', reason: 'stalled' });

      issue.retry();

      // Recovery clears it out of band, via a resolve from whatever observes
      // the media -- not by the retry itself.
      expect(issue.hasIssue()).toBe(true);
    });
  });

  describe('reset', () => {
    it('should forget every failure', () => {
      const issue = new MediaUnavailableIssue(createAPIDisplaying('camera-1'));

      issue.trigger({ targetID: 'camera-1', reason: 'stalled' });
      expect(issue.hasIssue()).toBe(true);

      issue.reset();

      expect(issue.hasIssue()).toBe(false);
      expect(issue.getNotification().metadata).toBeUndefined();
    });
  });
});
