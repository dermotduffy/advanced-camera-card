import { CameraEndpoint } from '../camera-manager/types';
import { HomeAssistant } from '../ha/types';
import { errorToConsole } from './basic';
import { homeAssistantSignPath } from './ha';

export const convertEndpointAddressToSignedWebsocket = async (
  hass: HomeAssistant,
  endpoint: CameraEndpoint,
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
