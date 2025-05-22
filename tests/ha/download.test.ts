import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { getMediaDownloadPath } from '../../src/ha/download';
import { ResolvedMediaCache, resolveMedia } from '../../src/ha/resolved-media.js';
import { createHASS } from '../test-utils';

vi.mock('../../src/ha/canonical-url.js', () => ({
  canonicalizeHAURL: vi.fn((_hass, url) => `canonicalized:${url}`),
}));
vi.mock('../../src/ha/resolved-media.js', () => ({
  resolveMedia: vi.fn(),
}));

describe('getMediaDownloadPath', () => {
  it('returns null if contentID is undefined', async () => {
    expect(
      await getMediaDownloadPath(createHASS(), undefined, mock<ResolvedMediaCache>()),
    ).toBeNull();
  });

  it('returns null if contentID is null', async () => {
    expect(
      await getMediaDownloadPath(createHASS(), null, mock<ResolvedMediaCache>()),
    ).toBeNull();
  });

  it('returns null if resolveMedia returns null', async () => {
    const hass = createHASS();
    const resolvedMediaCache = mock<ResolvedMediaCache>();
    vi.mocked(resolveMedia).mockResolvedValueOnce(null);

    expect(await getMediaDownloadPath(hass, 'id-1', resolvedMediaCache)).toBeNull();
    expect(resolveMedia).toHaveBeenCalledWith(hass, 'id-1', resolvedMediaCache);
  });

  it('returns endpoint if resolveMedia returns a url', async () => {
    const hass = createHASS();
    const resolvedMediaCache = mock<ResolvedMediaCache>();
    vi.mocked(resolveMedia).mockResolvedValueOnce({
      url: '/media/path.mp4',
      mime_type: 'video/mp4',
    });

    expect(await getMediaDownloadPath(hass, 'id-1', resolvedMediaCache)).toEqual({
      endpoint: 'canonicalized:/media/path.mp4',
    });
    expect(resolveMedia).toBeCalledWith(hass, 'id-1', resolvedMediaCache);
  });
});
