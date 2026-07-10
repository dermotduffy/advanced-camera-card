import { supports2WayAudio as gortcSupports2WayAudio } from '../camera-manager/utils/go2rtc/audio';
import type { CameraConfig } from '../config/schema/cameras';
import type { LiveProvider } from '../config/schema/cameras.js';
import type { EnabledProxyConfig } from '../config/schema/common/proxy';
import type { HomeAssistant } from '../ha/types';
import type { Endpoint } from '../types';

export const getResolvedLiveProvider = (
  config: CameraConfig | undefined,
): Exclude<LiveProvider, 'auto'> => {
  if (config?.live_provider === 'auto') {
    if (config.webrtc_card?.entity || config.webrtc_card?.url) {
      return 'webrtc-card';
    } else if (config.camera_entity) {
      return 'ha';
    } else if (config.frigate?.camera_name) {
      return 'jsmpeg';
    }
    // Default for auto is 'image'
    return 'image';
  }
  return config?.live_provider ?? 'image';
};

// Live providers that stream from a go2rtc server and share the `go2rtc`
// config block and endpoints.
const GO2RTC_LIVE_PROVIDERS: readonly LiveProvider[] = ['go2rtc', 'go2rtc-experimental'];

export const isGo2RTCLiveProvider = (provider: LiveProvider): boolean =>
  GO2RTC_LIVE_PROVIDERS.includes(provider);

export const liveProviderSupports2WayAudio = async (
  hass: HomeAssistant,
  config: CameraConfig,
  metadataFetchTimeoutSeconds: number,
  go2rtcMetadataEndpoint?: Endpoint | null,
  proxyConfig?: EnabledProxyConfig,
): Promise<boolean> => {
  if (!isGo2RTCLiveProvider(getResolvedLiveProvider(config))) {
    return false;
  }

  return gortcSupports2WayAudio(
    hass,
    metadataFetchTimeoutSeconds,
    go2rtcMetadataEndpoint,
    proxyConfig,
  );
};
