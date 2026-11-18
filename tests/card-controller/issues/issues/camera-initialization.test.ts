import { assert, describe, expect, it, vi } from 'vitest';

import type { CardController } from '../../../../src/card-controller/controller';
import { CameraInitializationIssue } from '../../../../src/card-controller/issues/issues/camera-initialization';
import {
  INTERNAL_CALLBACK_ACTION,
  type InternalCallbackActionConfig,
} from '../../../../src/config/schema/actions/custom/internal';
import type { ActionConfig } from '../../../../src/config/schema/actions/types';
import { createCardAPI } from '../../../test-utils';

const isCallbackAction = (
  action: ActionConfig,
): action is InternalCallbackActionConfig =>
  'advanced_camera_card_action' in action &&
  action.advanced_camera_card_action === INTERNAL_CALLBACK_ACTION;

const createAPI = (cameraTitles?: Record<string, string>): CardController => {
  const api = createCardAPI();
  vi.mocked(api.getCameraManager().reinitializeCamera).mockResolvedValue();
  vi.mocked(api.getCameraManager().getCameraMetadata).mockImplementation(
    (cameraID: string) =>
      cameraTitles?.[cameraID]
        ? { title: cameraTitles[cameraID], icon: { icon: 'mdi:cctv' } }
        : null,
  );
  return api;
};

// @vitest-environment jsdom
describe('CameraInitializationIssue', () => {
  it('should have correct key', () => {
    expect(new CameraInitializationIssue(createAPI()).key).toBe('camera_initialization');
  });

  describe('activation', () => {
    it('should not activate without a camera to report', () => {
      const issue = new CameraInitializationIssue(createAPI());

      expect(issue.hasIssue()).toBe(false);
      expect(issue.needsRetry()).toBe(false);
    });

    it.each([['failed' as const], ['degraded' as const]])(
      'should activate for a %s camera',
      (state) => {
        const issue = new CameraInitializationIssue(createAPI());

        issue.trigger({ cameraID: 'camera-1', state });

        expect(issue.hasIssue()).toBe(true);
        expect(issue.needsRetry()).toBe(true);
      },
    );

    it('should deactivate once every camera is initialized', () => {
      const issue = new CameraInitializationIssue(createAPI());

      issue.trigger({ cameraID: 'camera-1', state: 'failed' });
      issue.trigger({ cameraID: 'camera-2', state: 'degraded' });

      issue.resolve({ cameraID: 'camera-1' });
      expect(issue.hasIssue()).toBe(true);

      issue.resolve({ cameraID: 'camera-2' });
      expect(issue.hasIssue()).toBe(false);
    });

    it('should ignore a camera that was never reported', () => {
      const issue = new CameraInitializationIssue(createAPI());

      issue.resolve({ cameraID: 'camera-1' });

      expect(issue.hasIssue()).toBe(false);
    });

    it('should replace what was reported about a camera', () => {
      const issue = new CameraInitializationIssue(createAPI());

      issue.trigger({ cameraID: 'camera-1', state: 'failed' });
      issue.trigger({ cameraID: 'camera-1', state: 'degraded' });

      expect(issue.getNotification().metadata).toEqual([
        expect.objectContaining({
          text: 'camera-1: Camera partially initialized',
        }),
      ]);
    });

    it('should forget every camera on reset', () => {
      const issue = new CameraInitializationIssue(createAPI());

      issue.trigger({ cameraID: 'camera-1', state: 'failed' });
      issue.reset();

      expect(issue.hasIssue()).toBe(false);
    });
  });

  describe('getIssue', () => {
    it('should return null when not active', () => {
      expect(new CameraInitializationIssue(createAPI()).getIssue()).toBeNull();
    });

    it('should take the worst state when cameras differ', () => {
      const issue = new CameraInitializationIssue(createAPI());

      issue.trigger({ cameraID: 'camera-1', state: 'degraded' });
      issue.trigger({ cameraID: 'camera-2', state: 'failed' });

      expect(issue.getIssue()).toEqual(
        expect.objectContaining({
          icon: 'mdi:camera-off',
          severity: 'high',
          notification: expect.objectContaining({
            heading: expect.objectContaining({
              text: 'Cameras not fully initialized',
            }),
          }),
        }),
      );
    });

    it('should take the degraded state when no camera failed', () => {
      const issue = new CameraInitializationIssue(createAPI());

      issue.trigger({ cameraID: 'camera-1', state: 'degraded' });

      expect(issue.getIssue()).toEqual(
        expect.objectContaining({ icon: 'mdi:progress-helper', severity: 'medium' }),
      );
    });
  });

  describe('getNotification', () => {
    it('should return a notification regardless of active state', () => {
      const issue = new CameraInitializationIssue(createAPI());

      expect(issue.getNotification()).toEqual(
        expect.objectContaining({
          heading: expect.objectContaining({ text: expect.any(String) }),
          body: expect.objectContaining({ text: expect.any(String) }),
          link: expect.objectContaining({ url: expect.any(String) }),
        }),
      );
      expect(issue.getNotification().metadata).toBeUndefined();
    });

    it.each([
      ['failed' as const, 'Camera initialization failed', 'mdi:camera-off'],
      ['degraded' as const, 'Camera partially initialized', 'mdi:progress-helper'],
    ])('should give the %s state its own text and icon', (state, text, icon) => {
      const issue = new CameraInitializationIssue(createAPI());

      issue.trigger({ cameraID: 'camera.office', state });

      expect(issue.getNotification().metadata).toEqual([
        { icon, text: `camera.office: ${text}` },
      ]);
    });

    it('should use the camera title when available', () => {
      const issue = new CameraInitializationIssue(
        createAPI({ 'camera.office': 'Office' }),
      );

      issue.trigger({ cameraID: 'camera.office', state: 'failed' });

      expect(issue.getNotification().metadata).toEqual([
        expect.objectContaining({ text: 'Office: Camera initialization failed' }),
      ]);
    });

    it('should render the error as context, keyed by camera title', () => {
      const issue = new CameraInitializationIssue(
        createAPI({ 'camera.office': 'Office' }),
      );

      issue.trigger({
        cameraID: 'camera.office',
        state: 'failed',
        error: new Error('Could not find entity: camera.office'),
      });

      const notification = issue.getNotification();

      expect(notification.metadata).toEqual([
        expect.objectContaining({ text: 'Office: Camera initialization failed' }),
      ]);
      expect(notification.context).toEqual([
        'Office: Could not find entity: camera.office',
      ]);
    });

    it('should omit context for a camera reported without an error', () => {
      const issue = new CameraInitializationIssue(createAPI());

      issue.trigger({ cameraID: 'camera-1', state: 'degraded' });

      expect(issue.getNotification().context).toBeUndefined();
    });

    it('should include a retry control that retries the issue', async () => {
      const api = createAPI();
      const issue = new CameraInitializationIssue(api);

      const control = issue.getNotification().controls?.[0];
      expect(control).toMatchObject({ icon: 'mdi:refresh', dismiss: true });

      const tapAction = control?.actions?.tap_action;
      assert(!Array.isArray(tapAction) && tapAction && isCallbackAction(tapAction));
      await tapAction.callback(api);

      expect(api.getIssueManager().retry).toHaveBeenCalledWith(
        'camera_initialization',
        true,
      );
    });
  });

  describe('retry', () => {
    it('should initialize every reported camera again', () => {
      const api = createAPI();
      const issue = new CameraInitializationIssue(api);

      issue.trigger({ cameraID: 'camera-1', state: 'failed' });
      issue.trigger({ cameraID: 'camera-2', state: 'degraded' });

      // Other issues are still worth retrying in the same pass.
      expect(issue.retry()).toBe(false);

      expect(api.getCameraManager().reinitializeCamera).toHaveBeenCalledWith('camera-1');
      expect(api.getCameraManager().reinitializeCamera).toHaveBeenCalledWith('camera-2');
    });

    it('should not start a second attempt on a camera it is already retrying', () => {
      const api = createAPI();
      const issue = new CameraInitializationIssue(api);

      issue.trigger({ cameraID: 'camera-1', state: 'failed' });
      issue.retry();

      expect(issue.canRetryNow()).toBe(false);

      issue.retry();

      expect(api.getCameraManager().reinitializeCamera).toHaveBeenCalledTimes(1);
    });

    it('should retry a camera again once its attempt has settled', () => {
      const api = createAPI();
      const issue = new CameraInitializationIssue(api);

      issue.trigger({ cameraID: 'camera-1', state: 'failed' });
      issue.retry();

      // The camera manager reports the camera again once the attempt is over.
      issue.trigger({ cameraID: 'camera-1', state: 'failed' });

      expect(issue.canRetryNow()).toBe(true);

      issue.retry();

      expect(api.getCameraManager().reinitializeCamera).toHaveBeenCalledTimes(2);
    });

    it('should retry a camera whose attempt has not started yet', () => {
      const api = createAPI();
      const issue = new CameraInitializationIssue(api);

      issue.trigger({ cameraID: 'camera-1', state: 'failed' });
      issue.retry();

      issue.trigger({ cameraID: 'camera-2', state: 'degraded' });

      expect(issue.canRetryNow()).toBe(true);

      issue.retry();

      expect(api.getCameraManager().reinitializeCamera).toHaveBeenCalledTimes(2);
      expect(api.getCameraManager().reinitializeCamera).toHaveBeenCalledWith('camera-2');
    });

    it('should not raise an unhandled rejection when reinitializing a camera fails', async () => {
      const api = createAPI();
      vi.mocked(api.getCameraManager().reinitializeCamera).mockRejectedValue(
        new Error('attempt failed'),
      );
      const issue = new CameraInitializationIssue(api);

      issue.trigger({ cameraID: 'camera-1', state: 'failed' });
      issue.retry();

      // Reaching here without an unhandled rejection is the assertion.
      await vi.waitFor(() =>
        expect(api.getCameraManager().reinitializeCamera).toHaveBeenCalled(),
      );
    });
  });
});
