// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { CameraManager } from '../../../src/camera-manager/manager';
import type { ViewManagerEpoch } from '../../../src/card-controller/view/types';
import { AdvancedCameraCardViewerCarousel } from '../../../src/components/viewer/carousel';
import type { MediaPlayerController } from '../../../src/types';
import { ViewMediaType } from '../../../src/view/item';
import type { View } from '../../../src/view/view';
import { createHASS, IntersectionObserverMock, ResizeObserverMock } from '../../test-utils';
import { TestViewMedia } from '../../view/test-utils';

describe('viewer recording seek', () => {
  beforeAll(() => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  const seek = new Date('2024-01-15T05:20:00Z');

  const createCarousel = (contentID: string, paused = false) => {
    const carousel = new AdvancedCameraCardViewerCarousel();
    const cameraManager = mock<CameraManager>();
    cameraManager.getMediaSeekTime.mockResolvedValue(1200);
    const player = {
      seek: vi.fn(),
      playback: { isPaused: () => paused, play: vi.fn(), pause: vi.fn() },
    } as unknown as MediaPlayerController;
    const view = { context: { mediaViewer: { seek } } } as View;
    carousel.hass = createHASS();
    carousel.cameraManager = cameraManager;
    carousel.viewManagerEpoch = {
      manager: { getView: () => view },
    } as unknown as ViewManagerEpoch;
    const internals = carousel as unknown as {
      _media: TestViewMedia[];
      _selected: number;
      _mediaLoadedInfoSinkController: { get: () => { mediaPlayerController: MediaPlayerController } };
      _seekHandler: () => Promise<void>;
    };
    internals._media = [new TestViewMedia({
      contentID,
      mediaType: ViewMediaType.Recording,
      startTime: new Date('2024-01-15T05:00:00Z'),
      endTime: new Date('2024-01-15T06:00:00Z'),
    })];
    internals._selected = 0;
    internals._mediaLoadedInfoSinkController = { get: () => ({ mediaPlayerController: player }) };
    return { internals, cameraManager, player };
  };

  it('does not seek within an EVENT playlist after a DVR wall-clock seek', async () => {
    const { internals, cameraManager, player } = createCarousel(
      'dvrkit://camera.front/1705294800/1705298400',
    );
    await internals._seekHandler();
    expect(cameraManager.getMediaSeekTime).not.toHaveBeenCalled();
    expect(player.seek).not.toHaveBeenCalled();
  });

  it('keeps a paused DVR player paused during an in-range seek', async () => {
    const { internals, player } = createCarousel(
      'dvrkit://camera.front/1705294800/1705298400',
      true,
    );
    await internals._seekHandler();
    expect(player.playback?.play).not.toHaveBeenCalled();
    expect(player.seek).not.toHaveBeenCalled();
  });

  it.each([
    'media-source://frigate/recording/front',
    'media-source://reolink/recording/front',
  ])('continues seeking ordinary recording media: %s', async (contentID) => {
    const { internals, cameraManager, player } = createCarousel(contentID);
    await internals._seekHandler();
    expect(cameraManager.getMediaSeekTime).toHaveBeenCalledWith(internals._media[0], seek);
    expect(player.seek).toHaveBeenCalledWith(1200);
  });
});
