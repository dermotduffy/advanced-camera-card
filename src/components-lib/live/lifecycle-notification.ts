import {
  CameraLifecycleStatus,
  type CameraLifecycleState,
} from '../../camera-manager/lifecycle.js';
import type { Notification } from '../../config/schema/actions/types.js';
import { localize } from '../../localize/localize.js';
import { createMediaNotification } from '../notification/media.js';

export function getLifecycleNotification(
  state: CameraLifecycleState | null,
  cameraTitle?: string,
): Notification | null {
  switch (state?.status) {
    case CameraLifecycleStatus.Initializing:
      return createMediaNotification({
        icon: null,
        title: localize('error.camera_initializing'),
        targetTitle: cameraTitle,
      });
    case CameraLifecycleStatus.Failed:
      return createMediaNotification({
        icon: 'mdi:camera-off',
        title: localize('error.camera_initialization'),
        targetTitle: cameraTitle,
        detail: state.error instanceof Error ? state.error.message : undefined,
      });
  }
  return null;
}
