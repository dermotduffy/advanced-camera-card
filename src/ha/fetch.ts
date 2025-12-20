import { ZodSchema } from 'zod';
import { localize } from '../localize/localize';
import { AdvancedCameraCardError, Endpoint } from '../types';
import { homeAssistantSignPath } from './sign-path';
import { HomeAssistant } from './types';

/**
 * Fetch a JSON response from a signed or unsigned endpoint and validate it
 * against a Zod schema.
 * May throw.
 *
 * @param hass Home Assistant instance.
 * @param endpoint The endpoint to fetch from (string or Endpoint object).
 * @param schema The Zod schema to validate the response against.
 * @returns The parsed data or throws if fetch/validation fails.
 */
export const homeAssistantSignAndFetch = async <T>(
  hass: HomeAssistant,
  endpoint: Endpoint,
  schema: ZodSchema<T>,
  options?: {
    timeoutSeconds?: number;
  },
): Promise<T> => {
  let url: string | null = endpoint.endpoint;
  const sign = endpoint.sign;

  // Sign the path if needed
  if (sign) {
    try {
      url = await homeAssistantSignPath(hass, url);
    } catch (error) {
      throw new AdvancedCameraCardError(localize('error.failed_sign'), {
        endpoint,
        error,
      });
    }

    if (!url) {
      throw new AdvancedCameraCardError(localize('error.failed_sign'), {
        endpoint,
      });
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...(options?.timeoutSeconds && {
        signal: AbortSignal.timeout(options.timeoutSeconds * 1000),
      }),
    });
  } catch (error) {
    throw new AdvancedCameraCardError(localize('error.failed_fetch'), {
      endpoint,
      error,
    });
  }

  if (!response.ok) {
    throw new AdvancedCameraCardError(localize('error.failed_response'), {
      endpoint,
      response,
    });
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    throw new AdvancedCameraCardError(localize('error.invalid_response'), {
      endpoint,
      response,
      error,
    });
  }

  const parsed = schema.safeParse(data);

  if (!parsed.success) {
    throw new AdvancedCameraCardError(localize('error.invalid_response'), {
      endpoint,
      data,
      error: parsed.error,
    });
  }

  return parsed.data;
};
