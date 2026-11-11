import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolvedMediaSchema, type ResolvedMedia } from '../../src/ha/types';
import { homeAssistantWSRequest } from '../../src/ha/ws-request';
import { createHASS } from '../test-utils';

// @vitest-environment jsdom
describe('homeAssistantWSRequest', () => {
  const request = {
    type: 'foo',
  };
  const response: ResolvedMedia = {
    url: 'https://example.com/media.mp4',
    mime_type: 'video/mp4',
  };

  it('should return parsed data on successful call', async () => {
    const hass = createHASS();
    vi.mocked(hass.callWS).mockResolvedValueOnce(response);

    expect(await homeAssistantWSRequest(hass, resolvedMediaSchema, request)).toEqual(
      response,
    );
  });

  it('should return parsed data on successful call with passthrough', async () => {
    const hass = createHASS();
    vi.mocked(hass.callWS).mockResolvedValueOnce(JSON.stringify(response));

    expect(
      await homeAssistantWSRequest(hass, resolvedMediaSchema, request, {
        passthrough: true,
      }),
    ).toEqual(response);
  });

  it('should throw on error', async () => {
    const error = new Error('WS call failed');
    const hass = createHASS();
    vi.mocked(hass.callWS).mockRejectedValueOnce(error);

    await expect(
      homeAssistantWSRequest(hass, resolvedMediaSchema, request),
    ).rejects.toThrow(/Failed to receive response/);
  });

  it('should throw on empty response', async () => {
    const hass = createHASS();
    vi.mocked(hass.callWS).mockResolvedValueOnce(null);

    await expect(
      homeAssistantWSRequest(hass, resolvedMediaSchema, request),
    ).rejects.toThrow(/Received empty response/);
  });

  it('should throw error on parse failure', async () => {
    const hass = createHASS();
    vi.mocked(hass.callWS).mockResolvedValueOnce({});

    await expect(
      homeAssistantWSRequest(hass, resolvedMediaSchema, request),
    ).rejects.toThrow(/Received invalid response/);
  });

  it('should throw on JSON parse failure', async () => {
    const malformedJSONResponse = "{ foo: 'test', bar: 123 "; // Malformed JSON

    const hass = createHASS();
    vi.mocked(hass.callWS).mockResolvedValueOnce(malformedJSONResponse);

    await expect(
      homeAssistantWSRequest(hass, resolvedMediaSchema, request, {
        passthrough: true,
      }),
    ).rejects.toThrow(/Received invalid response/);
  });

  describe('with a timeout', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return a response that arrives in time', async () => {
      vi.useFakeTimers();
      const hass = createHASS();
      vi.mocked(hass.callWS).mockResolvedValueOnce(response);

      expect(
        await homeAssistantWSRequest(hass, resolvedMediaSchema, request, {
          timeoutSeconds: 2,
        }),
      ).toEqual(response);
    });

    it('should throw when the response does not arrive in time', async () => {
      vi.useFakeTimers();
      const hass = createHASS();
      vi.mocked(hass.callWS).mockReturnValueOnce(new Promise(() => {}));

      const result = homeAssistantWSRequest(hass, resolvedMediaSchema, request, {
        timeoutSeconds: 2,
      });
      vi.advanceTimersByTime(2 * 1000);

      await expect(result).rejects.toThrow(/Timed out waiting for response/);
    });
  });
});
