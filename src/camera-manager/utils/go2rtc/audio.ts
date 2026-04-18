import { EnabledProxyConfig } from '../../../config/schema/common/proxy';
import { homeAssistantSignAndFetch } from '../../../ha/fetch';
import { HomeAssistant } from '../../../ha/types';
import { createProxiedEndpointIfNecessary } from '../../../ha/web-proxy';
import { Endpoint } from '../../../types';
import { errorToConsole } from '../../../utils/basic';
import { Go2RTCStreamInfo, go2RTCStreamInfoSchema } from './types';

const getGo2RTCStreamMetadata = async (
  hass: HomeAssistant,
  endpoint: Endpoint,
  timeoutSeconds: number,
): Promise<Go2RTCStreamInfo | null> => {
  try {
    return await homeAssistantSignAndFetch(hass, endpoint, go2RTCStreamInfoSchema, {
      timeoutSeconds,
    });
  } catch (e) {
    errorToConsole(e as Error);
    return null;
  }
};

const streamSupports2WayAudio = (streamInfo: Go2RTCStreamInfo | null): boolean => {
  if (!streamInfo?.producers) {
    return false;
  }
  return streamInfo.producers.some(
    (producer) =>
      producer.medias?.some(
        (media) =>
          media.includes('audio') &&
          (media.includes('sendonly') || media.includes('sendrecv')),
      ) ?? false,
  );
};

/**
 * Fetch go2rtc metadata and determine if the stream supports 2-way audio.
 * Handles proxy transformation if proxy config requires it.
 * Returns false if the endpoint is not available or fetch fails.
 *
 * Note: Caller is responsible for checking if live_provider is 'go2rtc' before calling.
 *
 * @param hass Home Assistant instance.
 * @param go2rtcMetadataEndpoint The go2rtc metadata endpoint.
 * @param proxyConfig The resolved proxy configuration for live streams.
 * @returns True if supports 2-way audio, false otherwise.
 */
export const supports2WayAudio = async (
  hass: HomeAssistant,
  metadataFetchTimeoutSeconds: number,
  go2rtcMetadataEndpoint?: Endpoint | null,
  proxyConfig?: EnabledProxyConfig,
): Promise<boolean> => {
  if (!go2rtcMetadataEndpoint) {
    return false;
  }

  const endpoint = await createProxiedEndpointIfNecessary(
    hass,
    go2rtcMetadataEndpoint,
    proxyConfig,
    { openLimit: 1 },
  );
  if (!endpoint) {
    return false;
  }

  const streamInfo = await getGo2RTCStreamMetadata(
    hass,
    endpoint,
    metadataFetchTimeoutSeconds,
  );
  return streamSupports2WayAudio(streamInfo);
};
