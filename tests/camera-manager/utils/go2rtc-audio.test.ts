import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { supports2WayAudio } from '../../../src/camera-manager/utils/go2rtc/audio';
import { homeAssistantSignAndFetch } from '../../../src/ha/fetch';
import { HomeAssistant } from '../../../src/ha/types';
import { createProxiedEndpointIfNecessary } from '../../../src/ha/web-proxy';
import { Endpoint } from '../../../src/types';

vi.mock('../../../src/ha/fetch');
vi.mock('../../../src/ha/web-proxy');

describe('supports2WayAudio', () => {
  const hass = mock<HomeAssistant>();
  const endpoint: Endpoint = { endpoint: 'http://go2rtc', sign: true };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return false if no endpoint provided', async () => {
    expect(await supports2WayAudio(hass, null)).toBe(false);
  });

  it('should return false if fetch fails', async () => {
    vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue(endpoint);
    vi.mocked(homeAssistantSignAndFetch).mockRejectedValue(new Error('fetch error'));

    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await supports2WayAudio(hass, endpoint);

    expect(result).toBe(false);
    expect(spy).toHaveBeenCalledWith('fetch error');
    spy.mockRestore();
  });

  it('should return false if stream info has no producers', async () => {
    vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue(endpoint);
    vi.mocked(homeAssistantSignAndFetch).mockResolvedValue({ producers: undefined });

    expect(await supports2WayAudio(hass, endpoint)).toBe(false);
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

    expect(await supports2WayAudio(hass, endpoint)).toBe(false);
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

    expect(await supports2WayAudio(hass, endpoint)).toBe(true);
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

    expect(await supports2WayAudio(hass, endpoint)).toBe(true);
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

    expect(await supports2WayAudio(hass, endpoint)).toBe(false);
  });
});
