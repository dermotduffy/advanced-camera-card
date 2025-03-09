import { CameraProxyConfig } from '../../camera-manager/types';
import { HomeAssistant } from '../../ha/types';

export const HASS_WEB_PROXY_DOMAIN = 'hass_web_proxy';

const hasWebProxyAvailable = (hass: HomeAssistant): boolean => {
  return hass.config.components.includes(HASS_WEB_PROXY_DOMAIN);
};

export const getWebProxiedURL = (url: string, v?: number): string => {
  return `/api/${HASS_WEB_PROXY_DOMAIN}/v${v ?? 0}/?url=${encodeURIComponent(url)}`;
};

export const shouldUseWebProxy = (
  hass: HomeAssistant,
  proxyConfig: CameraProxyConfig,
  context: 'media' = 'media',
): boolean => {
  return hasWebProxyAvailable(hass) && !!proxyConfig[context];
};

/**
 * Request that HA sign a path. May throw.
 * @param hass The HomeAssistant object used to request the signature.
 * @param path The path to sign.
 * @param expires An optional number of seconds to sign the path for (by default
 * HA will sign for 30 seconds).
 * @returns The signed URL, or null if the response was malformed.
 */
export async function addDynamicProxyURL(
  hass: HomeAssistant,
  url_pattern: string,
  options?: {
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
      ssl_verification: options.sslVerification,
      ssl_ciphers: options.sslCiphers,
      open_limit: options.openLimit,
      ttl: options.ttl,
      allow_unauthenticated: options.allowUnauthenticated,
    }),
  });
}
