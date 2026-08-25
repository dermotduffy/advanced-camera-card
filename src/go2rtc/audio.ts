import type { EnabledProxyConfig } from '../config/schema/common/proxy';
import { homeAssistantSignAndFetch } from '../ha/fetch';
import type { HomeAssistant } from '../ha/types';
import { createProxiedEndpointIfNecessary } from '../ha/web-proxy';
import type { Endpoint } from '../types';
import { errorToConsole } from '../utils/basic';
import { go2RTCStreamInfoSchema, type Go2RTCStreamInfo } from './types';

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
 *
 * Note: Caller is responsible for checking if live_provider is 'go2rtc' before calling.
 *
 * @param hass Home Assistant instance.
 * @param go2rtcMetadataEndpoint The go2rtc metadata endpoint.
 * @param proxyConfig The resolved proxy configuration for live streams.
 * @returns True or false indicating support available or not respectively, or
 * `null` when the answer is unknown/unavailable.
 */
export const supports2WayAudio = async (
  hass: HomeAssistant,
  metadataFetchTimeoutSeconds: number,
  go2rtcMetadataEndpoint?: Endpoint | null,
  proxyConfig?: EnabledProxyConfig,
): Promise<boolean | null> => {
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

  try {
    return streamSupports2WayAudio(
      await homeAssistantSignAndFetch(hass, endpoint, go2RTCStreamInfoSchema, {
        timeoutSeconds: metadataFetchTimeoutSeconds,
      }),
    );
  } catch (e) {
    errorToConsole(e);

    // The metadata could not be read, so an unknown state is returned.
    return null;
  }
};
