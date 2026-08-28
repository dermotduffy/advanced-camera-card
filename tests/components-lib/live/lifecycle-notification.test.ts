import { describe, expect, it } from 'vitest';

import { CameraLifecycleStatus } from '../../../src/camera-manager/lifecycle';
import { getLifecycleNotification } from '../../../src/components-lib/live/lifecycle-notification';
import { TROUBLESHOOTING_URL } from '../../../src/const';
import { localize } from '../../../src/localize/localize';

describe('getLifecycleNotification', () => {
  it('should return a notification while initializing', () => {
    expect(
      getLifecycleNotification(
        { status: CameraLifecycleStatus.Initializing },
        'Front Door',
      ),
    ).toEqual({
      body: {
        text: `${localize('error.camera_initializing')}: Front Door`,
      },
      link: {
        url: TROUBLESHOOTING_URL,
        title: localize('error.troubleshooting'),
      },
      in_progress: true,
    });
  });

  it('should return a notification while initializing without a camera title', () => {
    expect(
      getLifecycleNotification({ status: CameraLifecycleStatus.Initializing }),
    ).toEqual({
      body: {
        text: localize('error.camera_initializing'),
      },
      link: {
        url: TROUBLESHOOTING_URL,
        title: localize('error.troubleshooting'),
      },
      in_progress: true,
    });
  });

  it('should return an error notification when failed', () => {
    expect(
      getLifecycleNotification({
        status: CameraLifecycleStatus.Failed,
        error: new Error('boom'),
      }),
    ).toEqual({
      heading: {
        icon: 'mdi:camera-off',
        text: localize('error.camera_initialization'),
      },
      body: { text: 'boom' },
      link: {
        url: TROUBLESHOOTING_URL,
        title: localize('error.troubleshooting'),
      },
      in_progress: true,
    });
  });

  it('should omit the reason when the failure is not an Error', () => {
    expect(
      getLifecycleNotification({
        status: CameraLifecycleStatus.Failed,
        error: 'boom',
      }),
    ).toEqual({
      body: {
        icon: 'mdi:camera-off',
        text: localize('error.camera_initialization'),
      },
      link: {
        url: TROUBLESHOOTING_URL,
        title: localize('error.troubleshooting'),
      },
      in_progress: true,
    });
  });

  it('should return null when ready', () => {
    expect(getLifecycleNotification({ status: CameraLifecycleStatus.Ready })).toBeNull();
  });

  it('should return null when there is no lifecycle state', () => {
    expect(getLifecycleNotification(null)).toBeNull();
  });
});
