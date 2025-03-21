import { CameraConfig } from '../../config/schema/cameras';

export const getCameraEntityFromConfig = (
  cameraConfig?: CameraConfig,
): string | null => {
  return cameraConfig?.camera_entity ?? cameraConfig?.webrtc_card?.entity ?? null;
};
