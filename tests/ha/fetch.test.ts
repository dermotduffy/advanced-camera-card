import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { homeAssistantSignAndFetch } from '../../src/ha/fetch';
import { homeAssistantSignPath } from '../../src/ha/sign-path';
import { AdvancedCameraCardError, Endpoint } from '../../src/types';
import { createHASS } from '../test-utils';

vi.mock('../../src/ha/sign-path');

describe('homeAssistantSignAndFetch', () => {
  const response = {
    val: 10,
  };
  const schema = z.object({
    val: z.number(),
  });
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(homeAssistantSignPath).mockResolvedValue('http://signed');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('should return parsed data on successful call with endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => response,
    });

    const endpoint: Endpoint = { endpoint: 'http://example.com' };
    expect(await homeAssistantSignAndFetch(createHASS(), endpoint, schema)).toEqual(
      response,
    );
    expect(homeAssistantSignPath).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith('http://example.com', {});
  });

  it('should pass timeout signal when timeoutSeconds is provided', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => response,
    });

    const endpoint: Endpoint = { endpoint: 'http://example.com' };
    expect(
      await homeAssistantSignAndFetch(createHASS(), endpoint, schema, {
        timeoutSeconds: 5,
      }),
    ).toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith('http://example.com', {
      signal: expect.any(AbortSignal),
    });
  });

  it('should sign path if requested', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => response,
    });

    const endpoint: Endpoint = {
      endpoint: 'http://example.com',
      sign: true,
    };
    const hass = createHASS();
    expect(await homeAssistantSignAndFetch(hass, endpoint, schema)).toEqual(response);
    expect(homeAssistantSignPath).toHaveBeenCalledWith(hass, 'http://example.com');
    expect(fetchMock).toHaveBeenCalledWith('http://signed', {});
  });

  it('should throw on sign failure', async () => {
    vi.mocked(homeAssistantSignPath).mockRejectedValueOnce(new Error('Sign failed'));

    const endpoint: Endpoint = {
      endpoint: 'http://example.com',
      sign: true,
    };
    await expect(
      homeAssistantSignAndFetch(createHASS(), endpoint, schema),
    ).rejects.toThrow(/Could not sign Home Assistant URL/);
  });

  it('should throw if sign path returns null', async () => {
    vi.mocked(homeAssistantSignPath).mockResolvedValue(null);

    const endpoint: Endpoint = {
      endpoint: 'http://example.com',
      sign: true,
    };
    await expect(
      homeAssistantSignAndFetch(createHASS(), endpoint, schema),
    ).rejects.toThrow(/Could not sign Home Assistant URL/);
  });

  it('should throw on fetch failure', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Fetch failed'));

    const endpoint: Endpoint = { endpoint: 'http://example.com' };
    try {
      await homeAssistantSignAndFetch(createHASS(), endpoint, schema);
      expect.fail('Should have thrown');
    } catch (e) {
      const error = e as AdvancedCameraCardError;
      expect(error.message).toMatch(/Could not fetch URL/);
      expect(error.context).toEqual({
        endpoint,
        error: expect.any(Error),
      });
      const context = error.context as { error: Error };
      expect(context.error.message).toBe('Fetch failed');
    }
  });

  it('should throw on non-ok response', async () => {
    const response = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as Response;
    fetchMock.mockResolvedValueOnce(response);

    const endpoint: Endpoint = { endpoint: 'http://example.com' };
    try {
      await homeAssistantSignAndFetch(createHASS(), endpoint, schema);
      expect.fail('Should have thrown');
    } catch (e) {
      expect((e as AdvancedCameraCardError).message).toMatch(
        /Failed to receive response/,
      );
      expect((e as AdvancedCameraCardError).context).toEqual({
        endpoint,
        response,
      });
    }
  });

  it('should throw on JSON parse failure', async () => {
    const response = {
      ok: true,
      json: async () => {
        throw new Error('JSON error');
      },
    } as unknown as Response;
    fetchMock.mockResolvedValueOnce(response);

    const endpoint: Endpoint = { endpoint: 'http://example.com' };
    try {
      await homeAssistantSignAndFetch(createHASS(), endpoint, schema);
      expect.fail('Should have thrown');
    } catch (e) {
      const error = e as AdvancedCameraCardError;
      expect(error.message).toMatch(/Received invalid response/);
      expect(error.context).toEqual({
        endpoint,
        response,
        error: expect.any(Error),
      });
      const context = error.context as { error: Error };
      expect(context.error.message).toBe('JSON error');
    }
  });

  it('should throw on schema validation failure', async () => {
    const data = { val: 'string' };
    const response = {
      ok: true,
      json: async () => data,
    } as unknown as Response;
    fetchMock.mockResolvedValueOnce(response);

    const endpoint: Endpoint = { endpoint: 'http://example.com' };

    try {
      await homeAssistantSignAndFetch(createHASS(), endpoint, schema);
      expect.fail('Should have thrown');
    } catch (e) {
      expect((e as AdvancedCameraCardError).message).toMatch(
        /Received invalid response/,
      );
      expect((e as AdvancedCameraCardError).context).toMatchObject({
        endpoint,
        data,
        error: expect.any(z.ZodError),
      });
    }
  });
});
