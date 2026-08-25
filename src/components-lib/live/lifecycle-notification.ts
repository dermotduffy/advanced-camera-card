import {
  CameraLifecycleStatus,
  type CameraLifecycleState,
} from '../../camera-manager/lifecycle.js';
import { localize } from '../../localize/localize.js';
import type { MediaNotificationOptions } from '../notification/media.js';

export function getLifecycleNotification(
  state: CameraLifecycleState | null,
  cameraTitle?: string,
): MediaNotificationOptions | null {
  switch (state?.status) {
    case CameraLifecycleStatus.Initializing:
      return {
        icon: 'mdi:progress-helper',
        title: localize('error.camera_initializing'),
        targetTitle: cameraTitle,
      };
    case CameraLifecycleStatus.Failed:
      return {
        icon: 'mdi:camera-off',
        title: localize('error.camera_initialization'),
        targetTitle: cameraTitle,
        detail: state.error instanceof Error ? state.error.message : undefined,
      };
  }
  return null;
}
