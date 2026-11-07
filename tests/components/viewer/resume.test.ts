// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { ResolvedMediaController } from '../../../src/components-lib/resolved-media-controller';
import { AdvancedCameraCardViewerProvider } from '../../../src/components/viewer/provider';
import { ViewMediaType } from '../../../src/view/item';
import { createHASS, IntersectionObserverMock } from '../../test-utils';
import { TestViewMedia } from '../../view/test-utils';

describe('DVR EVENT playback resume', () => {
  beforeAll(() => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const setup = async () => {
    const hass = createHASS();
    vi.mocked(hass.callWS)
      .mockResolvedValueOnce({ url: '/api/dvrkit/initial.m3u8' })
      .mockResolvedValueOnce({ url: '/api/dvrkit/resumed.m3u8' });
    const provider = new AdvancedCameraCardViewerProvider();
    provider.hass = hass;
    provider.forceSelected = true;
    provider.media = new TestViewMedia({
      contentID: 'dvrkit://camera.front/1705300000/1705303600',
      mediaType: ViewMediaType.Recording,
      startTime: new Date(1705300000 * 1000),
      endTime: new Date(1705303600 * 1000),
    });
    const video = document.createElement('video');
    video.currentTime = 123;
    const internals = provider as unknown as {
      _shouldLoad: () => boolean;
      _refProvider: { value: { getMediaPlayerController: () => Promise<unknown> } };
      _resolvedMediaController: ResolvedMediaController;
      _handleDvrkitPause: () => void;
      _handleDvrkitPlay: () => Promise<void>;
    };
    internals._shouldLoad = () => true;
    internals._refProvider = {
      value: { getMediaPlayerController: async () => ({ getFullscreenElement: () => video }) },
    };
    await internals._resolvedMediaController.hostUpdate();
    return { hass, internals };
  };

  it('reopens at the paused video position after a long pause', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
    const { hass, internals } = await setup();
    internals._handleDvrkitPause();
    clock.mockReturnValue(47000);
    await internals._handleDvrkitPlay();
    await internals._resolvedMediaController.hostUpdate();

    expect(hass.callWS).toHaveBeenCalledTimes(2);
    expect(hass.callWS).toHaveBeenNthCalledWith(2, {
      type: 'dvrkit/playback/url',
      entity_id: 'camera.front',
      start: 1705300123,
      end: 1705303600,
      replace_url: '/api/dvrkit/initial.m3u8',
    });
  });

  it('keeps initial autoplay on its session and replaces playback after a short pause', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
    const { hass, internals } = await setup();
    await internals._handleDvrkitPlay();
    await internals._resolvedMediaController.hostUpdate();
    expect(hass.callWS).toHaveBeenCalledTimes(1);
    internals._handleDvrkitPause();
    clock.mockReturnValue(2000);
    await internals._handleDvrkitPlay();
    await internals._resolvedMediaController.hostUpdate();
    expect(hass.callWS).toHaveBeenCalledTimes(2);
    expect(hass.callWS).toHaveBeenLastCalledWith({
      type: 'dvrkit/playback/url',
      entity_id: 'camera.front',
      start: 1705300123,
      end: 1705303600,
      replace_url: '/api/dvrkit/initial.m3u8',
    });
  });
});
