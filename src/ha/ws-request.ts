import type { MessageBase } from 'home-assistant-js-websocket';
import type { ZodType } from 'zod';

import { localize } from '../localize/localize';
import { AdvancedCameraCardError } from '../types';
import { Timer } from '../utils/timer';
import type { HomeAssistant } from './types';

interface HomeAssistantWSRequestOptions {
  // Some endpoints in Home Assistant pass JSON directly through, so the
  // response arrives wrapped in a string that must be unwrapped first.
  passthrough?: boolean;

  // Stop waiting for the response after this long (note: Home Assistant has no
  // way to cancel a websocket request, so it still completes the request the
  // caller will just no longer wait).
  timeoutSeconds?: number;
}

const callWS = async (
  hass: HomeAssistant,
  request: MessageBase,
  timeoutSeconds?: number,
): Promise<unknown> => {
  if (!timeoutSeconds) {
    return await hass.callWS(request);
  }

  const timer = new Timer();
  try {
    return await Promise.race([
      hass.callWS(request),
      new Promise<never>((_resolve, reject) =>
        timer.start(timeoutSeconds, () =>
          reject(
            new AdvancedCameraCardError(localize('error.timeout_response'), {
              request,
            }),
          ),
        ),
      ),
    ]);
  } finally {
    timer.stop();
  }
};

/**
 * Make a HomeAssistant websocket request. May throw.
 * @param hass The HomeAssistant object to send the request with.
 * @param schema The expected Zod schema of the response.
 * @param request The request to make.
 * @returns The parsed valid response or null on malformed.
 */
export async function homeAssistantWSRequest<T>(
  hass: HomeAssistant,
  schema: ZodType<T>,
  request: MessageBase,
  options?: HomeAssistantWSRequestOptions,
): Promise<T> {
  let response: unknown;
  try {
    response = await callWS(hass, request, options?.timeoutSeconds);
  } catch (e) {
    throw e instanceof AdvancedCameraCardError
      ? e
      : new AdvancedCameraCardError(localize('error.failed_response'), {
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
    return schema.parse(
      options?.passthrough ? JSON.parse(response as string) : response,
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_e) {
    throw new AdvancedCameraCardError(localize('error.invalid_response'), {
      request: request,
      response: response,
    });
  }
}
