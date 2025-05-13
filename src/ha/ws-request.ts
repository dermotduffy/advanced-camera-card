import { MessageBase } from 'home-assistant-js-websocket';
import { ZodSchema } from 'zod';
import { localize } from '../localize/localize';
import { AdvancedCameraCardError } from '../types';
import { HomeAssistant } from './types';

/**
 * Make a HomeAssistant websocket request. May throw.
 * @param hass The HomeAssistant object to send the request with.
 * @param schema The expected Zod schema of the response.
 * @param request The request to make.
 * @returns The parsed valid response or null on malformed.
 */

export async function homeAssistantWSRequest<T>(
  hass: HomeAssistant,
  schema: ZodSchema<T>,
  request: MessageBase,
  passthrough = false,
): Promise<T> {
  let response: unknown;
  try {
    response = await hass.callWS<T>(request);
  } catch (e) {
    throw new AdvancedCameraCardError(localize('error.failed_response'), {
      request: request,
      response: e,
    });
  }

  if (!response) {
    throw new AdvancedCameraCardError(localize('error.empty_response'), {
      request: request,
    });
  }

  try {
    // Some endpoints in Home Assistant pass JSON directly though, these end up
    // wrapped in a string and must be unwrapped first.
    return schema.parse(passthrough ? JSON.parse(response as string) : response);
  } catch (e) {
    throw new AdvancedCameraCardError(localize('error.invalid_response'), {
      request: request,
      response: response,
      error: e,
    });
  }
}
