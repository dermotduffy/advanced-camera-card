import { CameraProxyConfig } from '../camera-manager/types';
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

export const shouldUseWebProxy = (
  hass: HomeAssistant,
  proxyConfig: CameraProxyConfig,
  context: 'media' | 'live' = 'media',
): boolean => {
  return hasWebProxyAvailable(hass) && !!proxyConfig[context];
};

export async function addDynamicProxyURL(
  hass: HomeAssistant,
  url_pattern: string,
  options?: {
    proxyConfig?: CameraProxyConfig;
    urlID?: string;
    sslVerification?: boolean;
    sslCiphers?: string;
    openLimit?: number;
    ttl?: number;
    allowUnauthenticated?: boolean;
  },
): Promise<void> {
  await hass.callService(HASS_WEB_PROXY_DOMAIN, 'create_proxied_url', {
    url_pattern: url_pattern,
    ...(options && {
      url_id: options.urlID,
      ssl_verification:
        options.sslVerification ?? options?.proxyConfig?.ssl_verification,
      ssl_ciphers: options.sslCiphers ?? options?.proxyConfig?.ssl_ciphers,
      open_limit: options.openLimit,
      ttl: options.ttl,
      allow_unauthenticated: options.allowUnauthenticated,
    }),
  });
}

interface CreateProxiedEndpointOptions {
  context?: 'live' | 'media';
  ttl?: number;
  websocket?: boolean;
  openLimit?: number;
}

/**
 * Create a proxied endpoint if the proxy configuration requires it.
 * Handles dynamic proxy registration and returns a proxied Endpoint.
 * @param hass Home Assistant instance.
 * @param endpoint The endpoint to potentially proxy.
 * @param proxyConfig The camera proxy configuration. If undefined, returns original endpoint.
 * @param options Additional options for proxy registration.
 * @returns Proxied Endpoint if proxying needed, original endpoint otherwise.
 */
export const createProxiedEndpointIfNecessary = async (
  hass: HomeAssistant,
  endpoint: Endpoint,
  proxyConfig?: CameraProxyConfig,
  options?: CreateProxiedEndpointOptions,
): Promise<Endpoint> => {
  const context = options?.context ?? 'media';
  if (!proxyConfig || !shouldUseWebProxy(hass, proxyConfig, context)) {
    return endpoint;
  }
  if (proxyConfig.dynamic) {
    // Strip hash fragment for registration - it's client-side only and
    // not relevant for proxy pattern matching.
    const registrationUrl = endpoint.endpoint.split(/#/)[0];
    await addDynamicProxyURL(hass, registrationUrl, {
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
