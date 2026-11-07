// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DvrkitPlaybackSessions } from '../../../src/components-lib/resolved-media-controller';
import { createHASS } from '../../test-utils';

describe('DVR playback after a page reload', () => {
  afterEach(() => {
    sessionStorage.clear();
    history.replaceState(null, '', '/');
  });

  it('replaces four prior camera sessions without exhausting DVR capacity', async () => {
    const hass = createHASS();
    const active = new Set<string>();
    let sequence = 0;
    vi.mocked(hass.callWS).mockImplementation(async (request) => {
      const message = request as { replace_url?: string };
      if (message.replace_url) {
        active.delete(message.replace_url);
      }
      if (active.size >= 4) {
        throw new Error('DVR playback stream limit reached');
      }
      const url = `/api/dvrkit/hls/session-${++sequence}/capability/index.m3u8`;
      active.add(url);
      return { url } as never;
    });
    const media = [1, 2, 3, 4].map(
      (channel) => `dvrkit://camera.channel_${channel}/1705300000/1705303600`,
    );
    const original = new DvrkitPlaybackSessions();
    for (const id of media) {
      await original.resolve(hass, id, undefined, () => true);
    }
    expect(active.size).toBe(4);

    // A new document loses in-memory ownership but retains this tab's session storage.
    const reloaded = new DvrkitPlaybackSessions();
    for (const id of media) {
      expect(await reloaded.resolve(hass, id, undefined, () => true)).not.toBeNull();
    }
    expect(active).toEqual(new Set([
      '/api/dvrkit/hls/session-5/capability/index.m3u8',
      '/api/dvrkit/hls/session-6/capability/index.m3u8',
      '/api/dvrkit/hls/session-7/capability/index.m3u8',
      '/api/dvrkit/hls/session-8/capability/index.m3u8',
    ]));
  });

  it('releases the old dashboard before opening a different group in the same tab', async () => {
    const hass = createHASS();
    const active = new Set<string>();
    let sequence = 0;
    vi.mocked(hass.callWS).mockImplementation(async (request) => {
      const message = request as { replace_url?: string; release?: boolean };
      if (message.replace_url) {
        active.delete(message.replace_url);
      }
      if (message.release) {
        return { released: true } as never;
      }
      if (active.size >= 4) {
        throw new Error('DVR playback stream limit reached');
      }
      const url = `/api/dvrkit/hls/session-${++sequence}/capability/index.m3u8`;
      active.add(url);
      return { url } as never;
    });
    history.replaceState(null, '', '/dvr-cameras/group-1');
    const original = new DvrkitPlaybackSessions();
    for (const channel of [1, 2, 3, 4]) {
      await original.resolve(hass, `dvrkit://camera.channel_${channel}/100/200`, undefined, () => true);
    }
    history.replaceState(null, '', '/dvr-cameras/group-2');
    const nextGroup = new DvrkitPlaybackSessions();
    for (const channel of [5, 6, 7, 8]) {
      expect(await nextGroup.resolve(hass, `dvrkit://camera.channel_${channel}/100/200`, undefined, () => true)).not.toBeNull();
    }
    expect(active).toEqual(new Set([
      '/api/dvrkit/hls/session-5/capability/index.m3u8',
      '/api/dvrkit/hls/session-6/capability/index.m3u8',
      '/api/dvrkit/hls/session-7/capability/index.m3u8',
      '/api/dvrkit/hls/session-8/capability/index.m3u8',
    ]));
  });
});
