import type { Camera } from '../../../camera-manager/camera';
import type { HomeAssistant } from '../../../ha/types';
import {
  getResolvedLiveProvider,
  isGo2RTCLiveProvider,
} from '../../../utils/live-provider';
import { Go2RTCBackchannel } from './go2rtc';
import type { Backchannel, BackchannelErrorCallback } from './types';

export const createBackchannel = (
  hass: HomeAssistant,
  camera: Camera,
  errorCallback?: BackchannelErrorCallback,
): Backchannel | null => {
  if (!isGo2RTCLiveProvider(getResolvedLiveProvider(camera.getConfig()))) {
    return null;
  }

  const endpoint = camera.getEndpoints()?.go2rtc;
  return endpoint
    ? new Go2RTCBackchannel(hass, endpoint, camera.getLiveProxyConfig(), {
        errorCallback,
      })
    : null;
};
