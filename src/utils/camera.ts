import type { CameraConfig } from '../config/schema/cameras';
import type { RawAdvancedCameraCardConfig } from '../config/types';
import { isRecord } from './basic';

/**
 * Get a camera id.
 * @param config The camera config (either parsed or raw).
 * @returns A camera id.
 */
export function getCameraID(
  config?: CameraConfig | RawAdvancedCameraCardConfig | null,
): string {
  return (
    (typeof config?.id === 'string' && config.id) ||
    (typeof config?.camera_entity === 'string' && config.camera_entity) ||
    (isRecord(config?.webrtc_card) &&
      ((typeof config.webrtc_card['entity'] === 'string' &&
        config.webrtc_card['entity']) ||
        (typeof config.webrtc_card['url'] === 'string' && config.webrtc_card['url']))) ||
    (isRecord(config?.go2rtc) &&
      typeof config.go2rtc['url'] === 'string' &&
      typeof config.go2rtc['stream'] === 'string' &&
      // Artifical identifier that includes both url / stream.
      `${config.go2rtc['url']}#${config.go2rtc['stream']}`) ||
    (isRecord(config?.frigate) &&
      typeof config.frigate['camera_name'] === 'string' &&
      config.frigate['camera_name']) ||
    ''
  );
}
