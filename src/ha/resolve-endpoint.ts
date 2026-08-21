import type { EnabledProxyConfig } from '../config/schema/common/proxy';
import type { Endpoint } from '../types';
import { errorToConsole } from '../utils/basic';
import { homeAssistantGetSignedURLIfNecessary } from './sign-path';
import type { HomeAssistant } from './types';
import {
  createProxiedEndpointIfNecessary,
  type CreateProxiedEndpointOptions,
} from './web-proxy';

export const PROXY_URL_SIGN_EXPIRY_SECONDS = 24 * 60 * 60;

export type ResolvedEndpoint =
  | { success: true; url: string }
  | { success: false; error: 'proxy' | 'sign' };

// Turns an endpoint into a URL that can be fetched or connected to: proxied
// through Home Assistant when the proxy configuration calls for it, then signed
// when the result needs Home Assistant authentication.
export const resolveEndpointURL = async (
  hass: HomeAssistant,
  endpoint: Endpoint,
  options?: {
    proxyConfig?: EnabledProxyConfig | null;
    proxyEndpointOptions?: CreateProxiedEndpointOptions;
  },
): Promise<ResolvedEndpoint> => {
  // Proxy registration and signing both need an absolute URL.
  const absolute: Endpoint = {
    endpoint: new URL(endpoint.endpoint, document.baseURI).toString(),
    sign: endpoint.sign,
  };

  let proxied: Endpoint | null;
  if (!options?.proxyConfig?.enabled) {
    proxied = absolute;
  } else {
    try {
      proxied = await createProxiedEndpointIfNecessary(
        hass,
        { endpoint: absolute.endpoint, sign: false },
        options.proxyConfig,
        {
          ttl: PROXY_URL_SIGN_EXPIRY_SECONDS,
          openLimit: 0,
          ...options.proxyEndpointOptions,
        },
      );
    } catch (e: unknown) {
      errorToConsole(e);
      proxied = null;
    }
  }
  if (!proxied) {
    return { success: false, error: 'proxy' };
  }

  let signed: string | null;
  try {
    signed = await homeAssistantGetSignedURLIfNecessary(
      hass,
      proxied,
      PROXY_URL_SIGN_EXPIRY_SECONDS,
    );
  } catch (e: unknown) {
    errorToConsole(e);
    signed = null;
  }
  return signed ? { success: true, url: signed } : { success: false, error: 'sign' };
};
