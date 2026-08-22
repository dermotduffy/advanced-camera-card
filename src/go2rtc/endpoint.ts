import type { CameraConfig } from '../config/schema/cameras';
import type { Endpoint } from '../types';

interface EndpointOptions {
  url?: string;
  stream?: string;
}

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

  const endpoint = pathBuilder(url, encodeURIComponent(stream));
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
    // The `video` and `audio` parameters make go2rtc connect to the camera and
    // report what it finds vs just reporting its own configuration.
    (url, stream) => `${url}/api/streams?src=${stream}&video=all&audio=all`,
    options,
  );
};
