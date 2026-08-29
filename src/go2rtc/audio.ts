import { add } from 'date-fns';

import { ExpiringEqualityCache } from '../cache/expiring-cache';
import type { EnabledProxyConfig } from '../config/schema/common/proxy';
import { homeAssistantSignAndFetch } from '../ha/fetch';
import type { HomeAssistant } from '../ha/types';
import { createProxiedEndpointIfNecessary } from '../ha/web-proxy';
import type { Endpoint } from '../types';
import { errorToConsole } from '../utils/basic';
import { go2RTCStreamInfoSchema, type Go2RTCStreamInfo } from './types';

// Cache 2-way capabilities: these only changes when go2rtc configuration or
// camera hardware changes.
const TWO_WAY_AUDIO_CACHE_SECONDS = 5 * 60;

// Page-scoped because Home Assistant builds a new card on dashboard navigation,
// and every fetch makes go2rtc connect to the camera.
// See: https://github.com/dermotduffy/advanced-camera-card/issues/2299
const twoWayAudioSupportCache = new ExpiringEqualityCache<
  string,
  Promise<boolean | null>
>();

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

const fetch2WayAudioSupport = async (
  hass: HomeAssistant,
  metadataFetchTimeoutSeconds: number,
  go2rtcMetadataEndpoint: Endpoint,
  proxyConfig?: EnabledProxyConfig,
): Promise<boolean | null> => {
  const endpoint = await createProxiedEndpointIfNecessary(
    hass,
    go2rtcMetadataEndpoint,
    proxyConfig,
    { openLimit: 1 },
  );
  if (!endpoint) {
    return null;
  }

  try {
    return streamSupports2WayAudio(
      await homeAssistantSignAndFetch(hass, endpoint, go2RTCStreamInfoSchema, {
        timeoutSeconds: metadataFetchTimeoutSeconds,
      }),
    );
  } catch (e) {
    errorToConsole(e);
    return null;
  }
};

// Caller must verify the live provider is go2rtc before calling.
export const supports2WayAudio = async (
  hass: HomeAssistant,
  metadataFetchTimeoutSeconds: number,
  go2rtcMetadataEndpoint?: Endpoint | null,
  proxyConfig?: EnabledProxyConfig,
): Promise<boolean> => {
  if (!go2rtcMetadataEndpoint) {
    return false;
  }

  const key = go2rtcMetadataEndpoint.endpoint;
  const cachedPromise = twoWayAudioSupportCache.get(key);
  if (cachedPromise) {
    return (await cachedPromise) ?? false;
  }

  const request = fetch2WayAudioSupport(
    hass,
    metadataFetchTimeoutSeconds,
    go2rtcMetadataEndpoint,
    proxyConfig,
  );
  twoWayAudioSupportCache.set(
    key,
    request,
    add(new Date(), { seconds: TWO_WAY_AUDIO_CACHE_SECONDS }),
  );

  const isSupported = await request;

  // Inconclusive results are evicted so the next caller retries.
  if (isSupported === null) {
    twoWayAudioSupportCache.delete(key);
  }

  return isSupported ?? false;
};
