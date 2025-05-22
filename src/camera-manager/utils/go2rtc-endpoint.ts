import { CameraConfig } from '../../config/schema/cameras';
import { Endpoint } from '../../types';

export const getDefaultGo2RTCEndpoint = (
  cameraConfig: CameraConfig,
  options?: {
    url?: string;
    stream?: string;
  },
): Endpoint | null => {
  const url = options?.url ?? cameraConfig.go2rtc?.url;
  const stream = options?.stream ?? cameraConfig.go2rtc?.stream;

  if (!url || !stream) {
    return null;
  }
  const endpoint = `${url}/api/ws?src=${stream}`;

  return {
    endpoint: endpoint,

    // Only sign the endpoint if it's local to HA.
    sign: endpoint.startsWith('/'),
  };
};
