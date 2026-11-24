import type { Camera } from '../../../camera-manager/camera';
import type { HomeAssistant } from '../../../ha/types';
import {
  getResolvedLiveProvider,
  isGo2RTCLiveProvider,
} from '../../../utils/live-provider';
import { Go2RTCBackchannel } from './go2rtc';
import { HABackchannel } from './ha';
import type { Backchannel, BackchannelErrorCallback } from './types';

export const createBackchannel = (
  hass: HomeAssistant,
  camera: Camera,
  errorCallback?: BackchannelErrorCallback,
): Backchannel | null => {
  const config = camera.getConfig();
  const provider = getResolvedLiveProvider(config);
  if (provider === 'ha') {
    return config.camera_entity
      ? new HABackchannel(hass, config.camera_entity, { errorCallback })
      : null;
  }
  if (!isGo2RTCLiveProvider(provider)) {
    return null;
  }

  const endpoint = camera.getEndpoints()?.go2rtc;
  return endpoint
    ? new Go2RTCBackchannel(hass, endpoint, camera.getLiveProxyConfig(), {
        errorCallback,
      })
    : null;
};
