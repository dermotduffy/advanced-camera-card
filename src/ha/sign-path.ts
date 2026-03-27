import { type Endpoint, SignedPath, signedPathSchema } from '../types';
import { HomeAssistant } from './types';
import { homeAssistantWSRequest } from './ws-request';

/**
 * Request that HA sign a path. May throw.
 * @param hass The HomeAssistant object used to request the signature.
 * @param path The path to sign.
 * @param expires An optional number of seconds to sign the path for (by default
 * HA will sign for 30 seconds).
 * @returns The signed URL, or null if the response was malformed.
 */
export async function homeAssistantSignPath(
  hass: HomeAssistant,
  path: string,
  expires?: number,
): Promise<string | null> {
  const request = {
    type: 'auth/sign_path',
    path: path,
    expires: expires,
  };
  const response = await homeAssistantWSRequest<SignedPath>(
    hass,
    signedPathSchema,
    request,
  );
  if (!response) {
    return null;
  }
  return hass.hassUrl(response.path);
}

/**
 * Sign an endpoint's path if the endpoint requires signing.
 * @param hass The HomeAssistant object used to request the signature.
 * @param endpoint The endpoint to potentially sign.
 * @param expires An optional number of seconds to sign the path for.
 * @returns The signed or unsigned URL, or null if signing failed.
 */
export async function homeAssistantGetSignedURLIfNecessary(
  hass: HomeAssistant,
  endpoint: Endpoint,
  expires?: number,
): Promise<string | null> {
  if (!endpoint.sign) {
    return endpoint.endpoint;
  }
  return await homeAssistantSignPath(hass, endpoint.endpoint, expires);
}
