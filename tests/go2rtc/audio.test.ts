import { add } from 'date-fns';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { supports2WayAudio } from '../../src/go2rtc/audio';
import { homeAssistantSignAndFetch } from '../../src/ha/fetch';
import type { HomeAssistant } from '../../src/ha/types';
import { createProxiedEndpointIfNecessary } from '../../src/ha/web-proxy';
import type { Endpoint } from '../../src/types';

vi.mock('../../src/ha/fetch');
vi.mock('../../src/ha/web-proxy');

describe('supports2WayAudio', () => {
  const hass = mock<HomeAssistant>();

  // Answers are cached by endpoint for the life of the page, so each test uses
  // a unique endpoint.
  let endpointCount = 0;
  let endpoint: Endpoint;

  beforeEach(() => {
    vi.clearAllMocks();
    endpoint = { endpoint: `http://go2rtc-${++endpointCount}`, sign: true };
  });

  it('should return false if no endpoint provided', async () => {
    expect(await supports2WayAudio(hass, 2, null)).toBe(false);
  });

  it('should return false if fetch fails', async () => {
    vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue(endpoint);
    vi.mocked(homeAssistantSignAndFetch).mockRejectedValue(new Error('fetch error'));

    const spy = vi.spyOn(console, 'warn');
    const result = await supports2WayAudio(hass, 2, endpoint);

    expect(result).toBe(false);
    expect(spy).toHaveBeenCalledWith('fetch error');
    spy.mockRestore();
  });

  it('should return false if stream info has no producers', async () => {
    vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue(endpoint);
    vi.mocked(homeAssistantSignAndFetch).mockResolvedValue({ producers: undefined });

    expect(await supports2WayAudio(hass, 2, endpoint)).toBe(false);
  });

  it('should use default metadata fetch timeout', async () => {
    vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue(endpoint);
    vi.mocked(homeAssistantSignAndFetch).mockResolvedValue({ producers: [] });

    await supports2WayAudio(hass, 2, endpoint);

    expect(homeAssistantSignAndFetch).toHaveBeenCalledWith(
      hass,
      endpoint,
      expect.anything(),
      { timeoutSeconds: 2 },
    );
  });

  it('should use custom metadata fetch timeout when provided', async () => {
    vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue(endpoint);
    vi.mocked(homeAssistantSignAndFetch).mockResolvedValue({ producers: [] });

    await supports2WayAudio(hass, 15, endpoint);

    expect(homeAssistantSignAndFetch).toHaveBeenCalledWith(
      hass,
      endpoint,
      expect.anything(),
      { timeoutSeconds: 15 },
    );
  });

  it('should return false if no producer supports audio', async () => {
    vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue(endpoint);
    vi.mocked(homeAssistantSignAndFetch).mockResolvedValue({
      producers: [
        {
          medias: ['video,sendonly,h264'],
        },
      ],
    });

    expect(await supports2WayAudio(hass, 2, endpoint)).toBe(false);
  });

  it('should return true if producer supports audio and sendonly', async () => {
    vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue(endpoint);
    vi.mocked(homeAssistantSignAndFetch).mockResolvedValue({
      producers: [
        {
          medias: ['audio,sendonly,opus'],
        },
      ],
    });

    expect(await supports2WayAudio(hass, 2, endpoint)).toBe(true);
  });

  it('should return true if producer supports audio and sendrecv', async () => {
    vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue(endpoint);
    vi.mocked(homeAssistantSignAndFetch).mockResolvedValue({
      producers: [
        {
          medias: ['audio,sendrecv,pcmu'],
        },
      ],
    });

    expect(await supports2WayAudio(hass, 2, endpoint)).toBe(true);
  });

  it('should handle missing medias in producer', async () => {
    vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue(endpoint);
    vi.mocked(homeAssistantSignAndFetch).mockResolvedValue({
      producers: [
        {
          medias: undefined,
        },
      ],
    });

    expect(await supports2WayAudio(hass, 2, endpoint)).toBe(false);
  });

  it('should return false if proxied endpoint is null', async () => {
    vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue(null);

    expect(await supports2WayAudio(hass, 2, endpoint)).toBe(false);
  });

  describe('should cache answers', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should reuse an answer rather than fetch again', async () => {
      vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue(endpoint);
      vi.mocked(homeAssistantSignAndFetch).mockResolvedValue({
        producers: [{ medias: ['audio,sendonly,opus'] }],
      });

      expect(await supports2WayAudio(hass, 2, endpoint)).toBe(true);
      expect(await supports2WayAudio(hass, 2, endpoint)).toBe(true);

      expect(homeAssistantSignAndFetch).toHaveBeenCalledTimes(1);
    });

    it('should fetch once for simultaneous callers', async () => {
      vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue(endpoint);
      vi.mocked(homeAssistantSignAndFetch).mockResolvedValue({
        producers: [{ medias: ['audio,sendonly,opus'] }],
      });

      expect(
        await Promise.all([
          supports2WayAudio(hass, 2, endpoint),
          supports2WayAudio(hass, 2, endpoint),
        ]),
      ).toEqual([true, true]);

      expect(homeAssistantSignAndFetch).toHaveBeenCalledTimes(1);
    });

    it('should keep answers for different endpoints separate', async () => {
      const otherEndpoint: Endpoint = { endpoint: 'http://go2rtc-other', sign: true };

      vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue(endpoint);
      vi.mocked(homeAssistantSignAndFetch)
        .mockResolvedValueOnce({ producers: [{ medias: ['audio,sendonly,opus'] }] })
        .mockResolvedValueOnce({ producers: [{ medias: ['video,sendonly,h264'] }] });

      expect(await supports2WayAudio(hass, 2, endpoint)).toBe(true);
      expect(await supports2WayAudio(hass, 2, otherEndpoint)).toBe(false);
    });

    it('should fetch again after the answer expires', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-28T12:00:00Z'));

      vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue(endpoint);
      vi.mocked(homeAssistantSignAndFetch).mockResolvedValue({
        producers: [{ medias: ['audio,sendonly,opus'] }],
      });

      expect(await supports2WayAudio(hass, 2, endpoint)).toBe(true);

      vi.setSystemTime(add(new Date(), { minutes: 6 }));

      expect(await supports2WayAudio(hass, 2, endpoint)).toBe(true);
      expect(homeAssistantSignAndFetch).toHaveBeenCalledTimes(2);
    });

    it('should not reuse a failed fetch', async () => {
      vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue(endpoint);
      vi.mocked(homeAssistantSignAndFetch).mockRejectedValue(new Error('fetch error'));

      const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      expect(await supports2WayAudio(hass, 2, endpoint)).toBe(false);
      expect(await supports2WayAudio(hass, 2, endpoint)).toBe(false);

      expect(homeAssistantSignAndFetch).toHaveBeenCalledTimes(2);
      spy.mockRestore();
    });

    it('should return false to simultaneous callers when the fetch fails', async () => {
      vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue(endpoint);
      vi.mocked(homeAssistantSignAndFetch).mockRejectedValue(new Error('fetch error'));

      const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      expect(
        await Promise.all([
          supports2WayAudio(hass, 2, endpoint),
          supports2WayAudio(hass, 2, endpoint),
        ]),
      ).toEqual([false, false]);

      expect(homeAssistantSignAndFetch).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

    it('should not reuse an unavailable proxied endpoint', async () => {
      vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue(null);

      expect(await supports2WayAudio(hass, 2, endpoint)).toBe(false);
      expect(await supports2WayAudio(hass, 2, endpoint)).toBe(false);

      expect(createProxiedEndpointIfNecessary).toHaveBeenCalledTimes(2);
    });
  });
});
