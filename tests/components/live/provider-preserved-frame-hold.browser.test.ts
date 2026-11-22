import type { LitElement } from 'lit';
import { afterEach, assert, describe, expect, it, vi } from 'vitest';

import type { CardController } from '../../../src/card-controller/controller';
import type { VideoRTC } from '../../../src/components/live/providers/go2rtc/video-rtc';
import type { RawAdvancedCameraCardConfig } from '../../../src/config/types';
import type { DataURL } from '../../../src/types';
import { isDataURL } from '../../../src/utils/data-url';
import { sharedPreservedFrameStore } from '../../../src/utils/preserved-frame-store';
import { deepQuery } from '../../browser/dom';
import {
  CLIP_FIXTURE_FILENAME,
  createFixtureURL,
  SNAPSHOT_FIXTURE_FILENAME,
} from '../../browser/fixtures';
import { MountedCardFactory, type MountedCard } from '../../browser/mounted-card';
import {
  CAMERA_ENTITY,
  createGenericCameraHASS,
  createStillImageCardConfig,
} from '../../browser/test-utils';

// The live provider holding a preserved frame over a stream that has loaded but
// not yet painted. Kept apart from provider.browser.test.ts, which serves media
// through the shared test media worker: these tests need none.

const IMAGE_URL = createFixtureURL(SNAPSHOT_FIXTURE_FILENAME);

const DEFAULT_RATIO = [16, 9];

const mount = async (
  camera: RawAdvancedCameraCardConfig,
  live?: RawAdvancedCameraCardConfig,
): Promise<MountedCard> =>
  await MountedCardFactory.createFromSource(
    createStillImageCardConfig({
      cameras: [{ camera_entity: CAMERA_ENTITY, ...camera }],
      live: { show_image_during_load: false, ...live },
    }),
    createGenericCameraHASS(),
  );

// The provider writes its attributes during its own render, so its render is
// what a test has to wait for rather than that of the card that drew it.
const getProvider = async (card: MountedCard): Promise<LitElement> => {
  const provider = await card.waitForSelector<LitElement>(
    'advanced-camera-card-live-provider',
  );
  await provider.updateComplete;
  return provider;
};

// The source of the image the card's image player shows, if it shows one.
const getImageSource = (card: MountedCard): string | null => {
  const player = deepQuery(card.card, 'advanced-camera-card-image-updating-player');
  return (player && deepQuery<HTMLImageElement>(player, 'img'))?.src ?? null;
};

// A frame large enough for the card to accept as loaded media.
const createPreservedFrameURL = (): DataURL => {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  const url = canvas.toDataURL();
  assert(isDataURL(url));
  return url;
};

describe('AdvancedCameraCardLiveProvider', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('should keep a preserved frame over the stream until the stream has painted', () => {
    const mountGo2RTC = async (
      id: string,
      image?: RawAdvancedCameraCardConfig,
      camera?: RawAdvancedCameraCardConfig,
    ): Promise<MountedCard> =>
      await mount(
        {
          ...camera,
          id,
          live_provider: 'go2rtc',
          // A WebRTC stream never answered leaves the player's video to the test,
          // which an MSE stream would replace with its own.
          go2rtc: { url: 'http://localhost:1984', stream: 'office', modes: ['webrtc'] },
          proxy: { live: false },
          image: { refresh_seconds: 0, preserve_frame_seconds: 600, ...image },
        },
        { show_image_during_load: true },
      );

    // Plays the clip in the go2rtc player's own video, which the player then
    // announces as loaded media. The video's frame callbacks are held back
    // until the returned function is called, so the test decides when the
    // video has painted.
    const getPlayer = async (card: MountedCard): Promise<VideoRTC> =>
      await card.waitForSelector<VideoRTC>('advanced-camera-card-live-go2rtc-player');

    const playStream = async (card: MountedCard): Promise<() => void> => {
      const player = await getPlayer(card);
      const video = await card.waitForRender(() => player.video, 'the video');

      const callbacks: VideoFrameRequestCallback[] = [];
      vi.spyOn(video, 'requestVideoFrameCallback').mockImplementation((callback) =>
        callbacks.push(callback),
      );
      video.src = createFixtureURL(CLIP_FIXTURE_FILENAME);

      return () =>
        callbacks
          .splice(0)
          .forEach((callback) =>
            callback(performance.now(), {} as VideoFrameCallbackMetadata),
          );
    };

    const getLoadingImage = (card: MountedCard): Element | null =>
      deepQuery(card.card, 'advanced-camera-card-live-image');

    // The stream is shown once the provider stops hiding it.
    const waitForStreamShown = async (card: MountedCard): Promise<void> => {
      await card.waitForRender(
        () =>
          !deepQuery(card.card, 'advanced-camera-card-live-go2rtc')?.classList.contains(
            'hidden',
          ) || null,
        'the stream being shown',
      );
    };

    // The element drawn on top at the middle of an element, looking into
    // shadow roots.
    const getTopElementAtMiddle = (element: Element): Element | null => {
      const { left, top, width, height } = element.getBoundingClientRect();
      const [x, y] = [left + width / 2, top + height / 2];

      let found = document.elementFromPoint(x, y);
      while (found?.shadowRoot) {
        const inner = found.shadowRoot.elementFromPoint(x, y);
        if (!inner || inner === found) {
          break;
        }
        found = inner;
      }
      return found;
    };

    it('should keep the frame on top until the video presents a frame', async () => {
      const frameURL = createPreservedFrameURL();
      sharedPreservedFrameStore.set(
        { cameraID: 'hold-painted' },
        { url: frameURL, date: new Date() },
      );

      const card = await mountGo2RTC('hold-painted');
      await card.waitForRender(
        () => getImageSource(card) === frameURL || null,
        'the loading image showing the preserved frame',
      );

      const presentFrame = await playStream(card);
      await waitForStreamShown(card);

      // Taps go through the frame to the stream beneath.
      const image = getLoadingImage(card);
      assert(image instanceof HTMLElement);
      expect(getComputedStyle(image).pointerEvents).toBe('none');

      // Hit testing skips an element that takes no pointer events, so the
      // frame takes them for a moment to find what is drawn on top.
      image.style.pointerEvents = 'auto';
      const provider = await getProvider(card);
      const top = getTopElementAtMiddle(provider);
      image.style.pointerEvents = '';
      expect(top).toBeInstanceOf(HTMLImageElement);
      expect((top as HTMLImageElement).src).toBe(frameURL);

      presentFrame();

      await card.waitForRender(
        () => !getLoadingImage(card) || null,
        'the loading image being removed',
      );
    });

    it('should remove the frame if the video never presents a frame', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const frameURL = createPreservedFrameURL();
      sharedPreservedFrameStore.set(
        { cameraID: 'hold-never-painted' },
        { url: frameURL, date: new Date() },
      );

      const card = await mountGo2RTC('hold-never-painted');
      await card.waitForRender(
        () => getImageSource(card) === frameURL || null,
        'the loading image showing the preserved frame',
      );

      await playStream(card);
      await waitForStreamShown(card);
      expect(getLoadingImage(card)).not.toBeNull();

      await card.advanceSeconds(2);

      await card.waitForRender(
        () => !getLoadingImage(card) || null,
        'the loading image being removed',
      );
    });

    it('should remove a loading image that is not a preserved frame at once', async () => {
      const card = await mountGo2RTC('no-hold', { mode: 'url', url: IMAGE_URL });
      const provider = await getProvider(card);
      await card.waitForRender(
        () => provider.hasAttribute('sized') || null,
        'the loading image having loaded',
      );

      await playStream(card);
      await waitForStreamShown(card);

      expect(getLoadingImage(card)).toBeNull();
    });

    it('should remove its own ordinary snapshot while something else shows a preserved frame', async () => {
      const card = await mountGo2RTC('hold-elsewhere', { mode: 'url', url: IMAGE_URL });
      const provider = await getProvider(card);
      await card.waitForRender(
        () => provider.hasAttribute('sized') || null,
        'the loading image having loaded',
      );

      // Another element of the card shows a preserved frame of the camera.
      (card.card as unknown as { _controller: CardController })._controller
        .getPreservedFrameManager()
        .setShowing(
          'hold-elsewhere',
          { url: createPreservedFrameURL(), date: new Date() },
          new AbortController().signal,
        );

      await playStream(card);
      await waitForStreamShown(card);

      expect(getLoadingImage(card)).toBeNull();
    });

    it('should keep the frame in the box of the video', async () => {
      const frameURL = createPreservedFrameURL();
      sharedPreservedFrameStore.set(
        { cameraID: 'hold-box' },
        { url: frameURL, date: new Date() },
      );

      // A card of one ratio showing a camera of another, so the box of the
      // media is narrower than that of the provider.
      const card = await MountedCardFactory.createFromSource(
        createStillImageCardConfig({
          cameras: [
            {
              id: 'hold-box',
              camera_entity: CAMERA_ENTITY,
              live_provider: 'go2rtc',
              go2rtc: {
                url: 'http://localhost:1984',
                stream: 'office',
                modes: ['webrtc'],
              },
              proxy: { live: false },
              image: { refresh_seconds: 0, preserve_frame_seconds: 600 },
              dimensions: { aspect_ratio: [1, 1] },
            },
          ],
          live: { show_image_during_load: true },
          dimensions: {
            aspect_ratio_mode: 'static',
            aspect_ratio: DEFAULT_RATIO,
          },
        }),
        createGenericCameraHASS(),
      );
      await card.waitForRender(
        () => getImageSource(card) === frameURL || null,
        'the loading image showing the preserved frame',
      );

      await playStream(card);
      await waitForStreamShown(card);

      const image = getLoadingImage(card);
      const video = (await getPlayer(card)).video;
      assert(image && video);
      const imageBox = image.getBoundingClientRect();
      const videoBox = video.getBoundingClientRect();
      const providerBox = (await getProvider(card)).getBoundingClientRect();
      expect(videoBox.width).toBeLessThan(providerBox.width - 1);
      for (const side of ['left', 'top', 'width', 'height'] as const) {
        expect(imageBox[side]).toBeCloseTo(videoBox[side], 0);
      }
    });

    it('should release the frame when the card is detached', async () => {
      const frameURL = createPreservedFrameURL();
      sharedPreservedFrameStore.set(
        { cameraID: 'hold-detach' },
        { url: frameURL, date: new Date() },
      );

      const card = await mountGo2RTC('hold-detach');
      await card.waitForRender(
        () => getImageSource(card) === frameURL || null,
        'the loading image showing the preserved frame',
      );
      await playStream(card);
      await waitForStreamShown(card);
      const provider = await getProvider(card);
      expect(provider.hasAttribute('holding-preserved-frame')).toBe(true);

      // Nothing to load again once the card is back.
      const video = (await getPlayer(card)).video;
      assert(video);
      video.removeAttribute('src');
      video.load();

      card.detach();
      card.attach();
      await provider.updateComplete;

      expect(provider.hasAttribute('holding-preserved-frame')).toBe(false);
      expect(
        deepQuery(card.card, 'advanced-camera-card-live-image.over-media'),
      ).toBeNull();
    });

    it('should hold the frame afresh when the media is announced again', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const frameURL = createPreservedFrameURL();
      sharedPreservedFrameStore.set(
        { cameraID: 'hold-again' },
        { url: frameURL, date: new Date() },
      );

      const card = await mountGo2RTC('hold-again');
      await card.waitForRender(
        () => getImageSource(card) === frameURL || null,
        'the loading image showing the preserved frame',
      );
      await playStream(card);
      await waitForStreamShown(card);

      await card.advanceSeconds(1.5);
      expect(getLoadingImage(card)).not.toBeNull();

      // E.g. an audio track that changes, which the player announces again.
      (
        (await getPlayer(card)) as unknown as { _dispatchMediaLoadedEvent(): void }
      )._dispatchMediaLoadedEvent();

      await card.advanceSeconds(1);
      expect(getLoadingImage(card)).not.toBeNull();

      await card.advanceSeconds(1.5);
      await card.waitForRender(
        () => !getLoadingImage(card) || null,
        'the loading image being removed',
      );
    });
  });
});
