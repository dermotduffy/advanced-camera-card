import { describe, expect, it, vi } from 'vitest';
import { ResolvedMedia, resolvedMediaSchema } from '../../src/ha/types';
import { homeAssistantWSRequest } from '../../src/ha/ws-request';
import { createHASS } from '../test-utils';

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
      await homeAssistantWSRequest(hass, resolvedMediaSchema, request, true),
    ).toEqual(response);
  });

  it('should throw on error', async () => {
    const error = new Error('WS call failed');
    const hass = createHASS();
    vi.mocked(hass.callWS).mockRejectedValueOnce(error);

    await expect(
      homeAssistantWSRequest(hass, resolvedMediaSchema, request),
    ).rejects.toThrowError(/Failed to receive response/);
  });

  it('should throw on empty response', async () => {
    const hass = createHASS();
    vi.mocked(hass.callWS).mockResolvedValueOnce(null);

    await expect(
      homeAssistantWSRequest(hass, resolvedMediaSchema, request),
    ).rejects.toThrowError(/Received empty response/);
  });

  it('should throw error on parse failure', async () => {
    const hass = createHASS();
    vi.mocked(hass.callWS).mockResolvedValueOnce({});

    await expect(
      homeAssistantWSRequest(hass, resolvedMediaSchema, request),
    ).rejects.toThrowError(/Received invalid response/);
  });

  it('should throw on JSON parse failure', async () => {
    const malformedJSONResponse = "{ foo: 'test', bar: 123 "; // Malformed JSON

    const hass = createHASS();
    vi.mocked(hass.callWS).mockResolvedValueOnce(malformedJSONResponse);

    await expect(
      homeAssistantWSRequest(hass, resolvedMediaSchema, request, true),
    ).rejects.toThrowError(/Received invalid response/);
  });
});
