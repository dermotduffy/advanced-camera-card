import { describe, expect, it, vi } from 'vitest';

import { ResolvedMediaCache, resolveMedia } from '../../../src/ha/resolved-media';
import { createHASS } from '../../test-utils';

describe('dvrkit playback resolution', () => {
  it('requests an HLS playback URL on demand without caching expiring URLs', async () => {
    const hass = createHASS();
    vi.mocked(hass.callWS).mockResolvedValueOnce({ url: '/api/dvrkit/first.m3u8' }).mockResolvedValueOnce({ url: '/api/dvrkit/second.m3u8' });
    const cache = new ResolvedMediaCache();
    const id = 'dvrkit://camera.front/1705300000/1705303600';

    expect(await resolveMedia(hass, id, cache)).toEqual({ url: '/api/dvrkit/first.m3u8', mime_type: 'application/vnd.apple.mpegurl' });
    expect(await resolveMedia(hass, id, cache)).toEqual({ url: '/api/dvrkit/second.m3u8', mime_type: 'application/vnd.apple.mpegurl' });
    expect(hass.callWS).toHaveBeenCalledTimes(2);
    expect(hass.callWS).toHaveBeenCalledWith({
      type: 'dvrkit/playback/url', entity_id: 'camera.front', start: 1705300000, end: 1705303600,
    });
  });

  it('rejects malformed dvrkit content IDs without making a request', async () => {
    const hass = createHASS();
    expect(await resolveMedia(hass, 'dvrkit://camera.front/not-a-time/42')).toBeNull();
    expect(hass.callWS).not.toHaveBeenCalled();
  });

  it('returns null when playback URL resolution fails', async () => {
    const hass = createHASS();
    vi.mocked(hass.callWS).mockRejectedValue(new Error('Unavailable'));
    expect(await resolveMedia(hass, 'dvrkit://camera.front/100/200')).toBeNull();
  });
});
