import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResolvedMediaCache, resolveMedia } from '../../src/ha/resolved-media';
import { ResolvedMedia, resolvedMediaSchema } from '../../src/ha/types';
import { homeAssistantWSRequest } from '../../src/ha/ws-request';
import { errorToConsole } from '../../src/utils/basic';
import { createHASS } from '../test-utils';

vi.mock('../../src/ha/ws-request', () => ({
  homeAssistantWSRequest: vi.fn(),
}));
vi.mock('../../src/utils/basic', () => ({
  errorToConsole: vi.fn(),
}));

describe('ResolvedMediaCache', () => {
  it('should store and retrieve values', () => {
    const cache = new ResolvedMediaCache();
    const key = 'media-id';
    const resolvedMedia = {
      id: key,
      title: 'Test Media',
      mime_type: 'video/mp4',
      url: 'http://media',
      media_content_type: 'video',
      media_content_id: key,
    };
    cache.set(key, resolvedMedia);
    expect(cache.get(key)).toBe(resolvedMedia);
  });
});

describe('resolveMedia', () => {
  const mediaContentID = 'media-123';
  const resolvedMedia: ResolvedMedia = {
    mime_type: 'video/mp4',
    url: 'http://media',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns cached value if present', async () => {
    const cache = new ResolvedMediaCache();
    cache.set(mediaContentID, resolvedMedia);
    const result = await resolveMedia(createHASS(), mediaContentID, cache);
    expect(result).toBe(resolvedMedia);
    expect(homeAssistantWSRequest).not.toHaveBeenCalled();
  });

  it('fetches and caches value if not present in cache', async () => {
    vi.mocked(homeAssistantWSRequest).mockResolvedValueOnce(resolvedMedia);

    const hass = createHASS();
    const cache = new ResolvedMediaCache();
    const result = await resolveMedia(hass, mediaContentID, cache);

    expect(homeAssistantWSRequest).toBeCalledWith(
      hass,
      resolvedMediaSchema,
      expect.objectContaining({
        type: 'media_source/resolve_media',
        media_content_id: mediaContentID,
      }),
    );
    expect(result).toEqual(resolvedMedia);
    expect(cache.get(mediaContentID)).toEqual(resolvedMedia);
  });

  it('returns null and logs error if request fails', async () => {
    const error = new Error('fail');
    vi.mocked(homeAssistantWSRequest).mockRejectedValueOnce(error);

    const cache = new ResolvedMediaCache();
    const result = await resolveMedia(createHASS(), mediaContentID, cache);
    expect(result).toBeNull();
    expect(errorToConsole).toBeCalledWith(error);
  });

  it('does not cache null results', async () => {
    vi.mocked(homeAssistantWSRequest).mockResolvedValueOnce(null);
    const cache = new ResolvedMediaCache();
    const result = await resolveMedia(createHASS(), mediaContentID, cache);
    expect(result).toBeNull();
    expect(cache.get(mediaContentID)).toBeNull();
  });

  it('works without cache argument', async () => {
    vi.mocked(homeAssistantWSRequest).mockResolvedValueOnce(resolvedMedia);
    const result = await resolveMedia(createHASS(), mediaContentID);
    expect(result).toEqual(resolvedMedia);
  });
});
