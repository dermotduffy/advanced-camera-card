import type { ReadonlyDeep } from 'type-fest';

import type { CameraConfig } from '../../config/schema/cameras';

export const getCameraEntityFromConfig = (
  cameraConfig?: ReadonlyDeep<CameraConfig>,
): string | null => {
  return cameraConfig?.camera_entity ?? cameraConfig?.webrtc_card?.entity ?? null;
};
