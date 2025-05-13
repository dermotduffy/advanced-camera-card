import { homeAssistantSignPath } from '../ha/sign-path';
import { HomeAssistant } from '../ha/types';
import { Endpoint } from '../types';
import { errorToConsole } from './basic';

export const convertEndpointAddressToSignedWebsocket = async (
  hass: HomeAssistant,
  endpoint: Endpoint,
  expires?: number,
): Promise<string | null> => {
  if (!endpoint.sign) {
    return endpoint.endpoint;
  }

  let response: string | null | undefined;
  try {
    response = await homeAssistantSignPath(hass, endpoint.endpoint, expires);
  } catch (e) {
    errorToConsole(e as Error);
  }

  return response ? response.replace(/^http/i, 'ws') : null;
};
