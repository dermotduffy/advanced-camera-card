import { EnabledProxyConfig, ResolvedProxyConfig } from '../config/schema/common/proxy';
import { Endpoint } from '../types';
import { HomeAssistant } from './types';

export const HASS_WEB_PROXY_DOMAIN = 'hass_web_proxy';

const hasWebProxyAvailable = (hass: HomeAssistant): boolean => {
  return hass.config.components.includes(HASS_WEB_PROXY_DOMAIN);
};

interface ProxiedURLOptions {
  version?: number;
  websocket?: boolean;
}

/**
 * Get a proxied URL for the given URL.
 * @param url The URL to proxy.
 * @param options Options for the proxied URL.
 * @returns The proxied URL.
 */
export const getWebProxiedURL = (url: string, options?: ProxiedURLOptions): string => {
  return (
    `/api/${HASS_WEB_PROXY_DOMAIN}/v${options?.version ?? 0}/` +
    `${options?.websocket ? 'ws' : ''}?url=${encodeURIComponent(url)}`
  );
};

export async function addDynamicProxyURL(
  hass: HomeAssistant,
  url_pattern: string,
  options?: {
    proxyConfig?: ResolvedProxyConfig;
    urlID?: string;
    openLimit?: number;
    ttl?: number;
    allowUnauthenticated?: boolean;
  },
): Promise<void> {
  await hass.callService(HASS_WEB_PROXY_DOMAIN, 'create_proxied_url', {
    url_pattern: url_pattern,
    ...(options && {
      url_id: options.urlID,
      ssl_verification: options.proxyConfig?.ssl_verification,
      ssl_ciphers: options.proxyConfig?.ssl_ciphers,
      open_limit: options.openLimit,
      ttl: options.ttl,
      allow_unauthenticated: options.allowUnauthenticated,
    }),
  });
}

export interface CreateProxiedEndpointOptions {
  ttl?: number;
  websocket?: boolean;
  openLimit?: number;
}

/**
 * Create a proxied endpoint if the proxy configuration requires it.
 * Handles dynamic proxy registration and returns a proxied Endpoint.
 * @param hass Home Assistant instance.
 * @param endpoint The endpoint to potentially proxy.
 * @param proxyConfig The proxy configuration. If undefined or not enabled,
 * returns the original endpoint.
 * @param options Additional options for proxy registration.
 * @returns Proxied Endpoint if proxying needed, original endpoint if proxying
 * is not enabled, or null if proxying is required but unavailable.
 */
export const createProxiedEndpointIfNecessary = async (
  hass: HomeAssistant,
  endpoint: Endpoint,
  proxyConfig?: EnabledProxyConfig,
  options?: CreateProxiedEndpointOptions,
): Promise<Endpoint | null> => {
  if (!proxyConfig || !proxyConfig.enabled) {
    return endpoint;
  }

  if (!hasWebProxyAvailable(hass)) {
    return proxyConfig.enforce === true ? null : endpoint;
  }

  if (proxyConfig.dynamic) {
    // Strip hash fragment — it's client-side only and not relevant for
    // proxy pattern matching.
    const url = endpoint.endpoint.split(/#/)[0];
    await addDynamicProxyURL(hass, url, {
      proxyConfig,
      ttl: options?.ttl,
      openLimit: options?.openLimit ?? 0,
    });
  }
  return {
    endpoint: getWebProxiedURL(endpoint.endpoint, { websocket: options?.websocket }),
    sign: true,
  };
};
