import { CameraConfig } from '../../../config/schema/cameras';
import { Endpoint } from '../../../types';

type EndpointOptions = {
  url?: string;
  stream?: string;
};

const buildGo2RTCEndpoint = (
  cameraConfig: CameraConfig,
  pathBuilder: (url: string, stream: string) => string,
  options?: EndpointOptions,
): Endpoint | null => {
  const url = options?.url ?? cameraConfig.go2rtc?.url;
  const stream = options?.stream ?? cameraConfig.go2rtc?.stream;

  if (!url || !stream) {
    return null;
  }

  const endpoint = pathBuilder(url, stream);
  return {
    endpoint,
    // Only sign the endpoint if it's local to HA.
    sign: endpoint.startsWith('/'),
  };
};

export const getGo2RTCStreamEndpoint = (
  cameraConfig: CameraConfig,
  options?: EndpointOptions,
): Endpoint | null => {
  return buildGo2RTCEndpoint(
    cameraConfig,
    (url, stream) => `${url}/api/ws?src=${stream}`,
    options,
  );
};

export const getGo2RTCMetadataEndpoint = (
  cameraConfig: CameraConfig,
  options?: EndpointOptions,
): Endpoint | null => {
  return buildGo2RTCEndpoint(
    cameraConfig,
    // Use probe parameters to trigger active stream detection.
    // Without these, go2rtc only returns static config without producer medias.
    (url, stream) => `${url}/api/streams?src=${stream}&video=all&audio=all&microphone`,
    options,
  );
};
