import { describe, expect, it } from 'vitest';

import { CameraLifecycleStatus } from '../../../src/camera-manager/lifecycle';
import { getLifecycleNotification } from '../../../src/components-lib/live/lifecycle-notification';
import { localize } from '../../../src/localize/localize';

describe('getLifecycleNotification', () => {
  it('should return a notification while initializing', () => {
    expect(
      getLifecycleNotification(
        { status: CameraLifecycleStatus.Initializing },
        'Front Door',
      ),
    ).toEqual({
      icon: 'mdi:progress-helper',
      title: localize('error.camera_initializing'),
      targetTitle: 'Front Door',
    });
  });

  it('should return an error notification when failed', () => {
    expect(
      getLifecycleNotification({
        status: CameraLifecycleStatus.Failed,
        error: new Error('boom'),
      }),
    ).toEqual({
      icon: 'mdi:camera-off',
      title: localize('error.camera_initialization'),
      targetTitle: undefined,
      detail: 'boom',
    });
  });

  it('should omit the reason when the failure is not an Error', () => {
    expect(
      getLifecycleNotification({
        status: CameraLifecycleStatus.Failed,
        error: 'boom',
      }),
    ).toEqual({
      icon: 'mdi:camera-off',
      title: localize('error.camera_initialization'),
      targetTitle: undefined,
    });
  });

  it('should return null when ready', () => {
    expect(getLifecycleNotification({ status: CameraLifecycleStatus.Ready })).toBeNull();
  });

  it('should return null when there is no lifecycle state', () => {
    expect(getLifecycleNotification(null)).toBeNull();
  });
});
