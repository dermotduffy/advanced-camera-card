import type { LitElement } from 'lit';
import { assert, describe, expect, it } from 'vitest';

import type { CameraConfig } from '../../src/config/schema/cameras';
import type { MediaLoadedInfoEventDetail } from '../../src/types';
import {
  getLastFrameKey,
  lastFrameStore,
  type LastFrame,
} from '../../src/utils/last-frame-store';
import { deepQuery } from '../browser/dom';
import { MountedCardFactory, type MountedCard } from '../browser/mounted-card';
import {
  CAMERA_ENTITY,
  createGenericCameraHASS,
  createStillImageCameraConfig,
  createStillImageCardConfig,
  isMediaLoadedInfoEventDetail,
} from '../browser/test-utils';

const UNRELATED_ENTITY = 'input_boolean.unrelated';

const IMAGE_ERROR_EVENT = 'advanced-camera-card:image-updating-player:error';

// The size of the static image fixture the player loads. Everything downstream
// sizes the card from what the player measured, so these are read from the
// media rather than declared anywhere in the configuration.
const FIXTURE_WIDTH = 320;
const FIXTURE_HEIGHT = 180;

const mount = async (): Promise<MountedCard> => {
  const hass = createGenericCameraHASS({ entities: { [UNRELATED_ENTITY]: 'off' } });
  return await MountedCardFactory.createFromSource(createStillImageCardConfig(), hass);
};

const getMediaLoadedInfos = (card: MountedCard): MediaLoadedInfoEventDetail[] =>
  card.events
    .getEntries('advanced-camera-card:media:loaded')
    .map((entry) => entry.detail)
    .filter(isMediaLoadedInfoEventDetail);

describe('AdvancedCameraCardImageUpdatingPlayer', () => {
  it('should announce the media load once even when the card re-renders', async () => {
    const card = await mount();

    const player = await card.waitForSelector<LitElement>(
      'advanced-camera-card-image-updating-player',
    );
    await card.events.waitForFirst('advanced-camera-card:media:loaded');

    // Something changes that the media knows nothing about. Announcing the
    // media load here would mean the player had quietly reloaded, which is how
    // a stream that churns looks from the outside.
    card.setEntityState(UNRELATED_ENTITY, 'on');

    // The card renders, and then the player does: each level only asks the next
    // to render once it has rendered itself, so a second announcement would
    // arrive by the end of this.
    await card.updateComplete;
    await player.updateComplete;

    const loads = getMediaLoadedInfos(card);
    expect(loads).toHaveLength(1);
    expect(loads[0].info.targetID).toBe(CAMERA_ENTITY);
  });

  it('should ignore an image failure that arrives after the card leaves the page', async () => {
    const card = await mount();
    const player = await card.waitForSelector(
      'advanced-camera-card-image-updating-player',
    );
    const image = await card.waitForSelector('img');

    const failures: Event[] = [];
    player.addEventListener(IMAGE_ERROR_EVENT, (ev) => failures.push(ev));

    image.dispatchEvent(new Event('error'));
    expect(failures).toHaveLength(1);

    // The browser answers a request the player made before the card came off
    // the page. Nobody is looking at the media it was for, so the player must
    // say nothing about it.
    card.detach();
    image.dispatchEvent(new Event('error'));

    expect(failures).toHaveLength(1);
  });

  it('should announce the size of the media itself', async () => {
    const card = await mount();

    await card.events.waitForFirst('advanced-camera-card:media:loaded');

    const [load] = getMediaLoadedInfos(card);
    expect(load.info.width).toBe(FIXTURE_WIDTH);
    expect(load.info.height).toBe(FIXTURE_HEIGHT);
  });

  describe('in image mode last_frame', () => {
    // A 1x1 PNG, standing in for a frame captured from a live stream.
    const FRAME_URL =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    const mountLastFrame = async (
      cameraEntity: string,
      showTime = true,
    ): Promise<MountedCard> => {
      const hass = createGenericCameraHASS({ cameras: [cameraEntity] });
      return await MountedCardFactory.createFromSource(
        createStillImageCardConfig({
          cameras: [
            {
              ...createStillImageCameraConfig(cameraEntity),
              image: { mode: 'last_frame', last_frame: { show_time: showTime } },
            },
          ],
        }),
        hass,
      );
    };

    // Keep a frame for the camera the card's image player shows, under the key
    // the card uses (its camera ID and configuration).
    const setFrame = async (card: MountedCard, frame: LastFrame): Promise<void> => {
      const player = await card.waitForSelector<
        HTMLElement & { cameraID?: string; cameraConfig?: CameraConfig }
      >('advanced-camera-card-image-updating-player');
      assert(player.cameraID);
      lastFrameStore.set(
        getLastFrameKey(player.cameraID, player.cameraConfig),
        frame,
        86400,
      );
    };

    const showsFrame = async (card: MountedCard): Promise<void> => {
      await card.waitForRender(
        () =>
          deepQuery<HTMLImageElement>(card.card, 'img')?.src === FRAME_URL ? true : null,
        'the captured frame',
      );
    };

    it('should show the default image until a frame was captured, then the frame', async () => {
      const card = await mountLastFrame('camera.last_frame_a');
      const image = await card.waitForSelector<HTMLImageElement>('img');
      expect(image.src).toContain('iris-screensaver');
      expect(deepQuery(card.card, '.last-frame-time')).toBeNull();

      // An hour ago: within the default maximum age (the date shows only when
      // that was another day; formatLastFrameTime's own tests cover the date).
      const capturedAt = new Date(Date.now() - 60 * 60 * 1000);
      await setFrame(card, { url: FRAME_URL, capturedAt });

      await showsFrame(card);
      const time = await card.waitForSelector<HTMLElement>('.last-frame-time');
      const sameDay = capturedAt.toDateString() === new Date().toDateString();
      expect(time.textContent?.trim()).toBe(
        capturedAt.toLocaleString(undefined, {
          ...(!sameDay && { day: 'numeric', month: 'short' }),
          hour: '2-digit',
          minute: '2-digit',
        }),
      );
    });

    it('should not show the capture time when switched off', async () => {
      const card = await mountLastFrame('camera.last_frame_b', false);
      await setFrame(card, { url: FRAME_URL, capturedAt: new Date() });

      await showsFrame(card);
      expect(deepQuery(card.card, '.last-frame-time')).toBeNull();
    });

    it('should keep the capture time out of the zoom', async () => {
      const card = await MountedCardFactory.createFromSource(
        createStillImageCardConfig({
          cameras: [
            {
              ...createStillImageCameraConfig('camera.last_frame_zoom'),
              image: { mode: 'last_frame' },
            },
          ],
          live: { zoomable: true },
        }),
        createGenericCameraHASS({ cameras: ['camera.last_frame_zoom'] }),
      );
      await setFrame(card, { url: FRAME_URL, capturedAt: new Date() });
      await card.events.waitForFirst('advanced-camera-card:media:loaded');
      const time = await card.waitForSelector<HTMLElement>('.last-frame-time');
      const before = time.getBoundingClientRect();

      const zoomer = deepQuery<HTMLElement & { settings?: unknown }>(
        card.card,
        'advanced-camera-card-zoomer',
      );
      assert(zoomer);
      zoomer.settings = { zoom: 3, pan: { x: 0, y: 100 } };
      await expect
        .poll(() => new DOMMatrix(getComputedStyle(zoomer).transform).a)
        .toBeCloseTo(3);

      // Neither enlarged nor moved with the picture.
      const after = time.getBoundingClientRect();
      expect(after.width).toBeCloseTo(before.width);
      expect(after.height).toBeCloseTo(before.height);
      expect(after.left).toBeCloseTo(before.left);
      expect(after.bottom).toBeCloseTo(before.bottom);
    });

    it('should find the frame again in a card rebuilt with the same camera only', async () => {
      // Two cards that give different cameras the same `id`.
      const mountWithID = async (cameraEntity: string): Promise<MountedCard> =>
        await MountedCardFactory.createFromSource(
          createStillImageCardConfig({
            cameras: [
              {
                ...createStillImageCameraConfig(cameraEntity),
                id: 'front',
                image: { mode: 'last_frame' },
              },
            ],
          }),
          createGenericCameraHASS({
            cameras: ['camera.last_frame_front_a', 'camera.last_frame_front_b'],
          }),
        );

      const first = await mountWithID('camera.last_frame_front_a');
      await setFrame(first, { url: FRAME_URL, capturedAt: new Date() });
      await showsFrame(first);
      first.destroy();

      // The same camera in a new card (e.g. back from another dashboard).
      const rebuilt = await mountWithID('camera.last_frame_front_a');
      await showsFrame(rebuilt);
      rebuilt.destroy();

      // Another camera under the same `id`.
      const other = await mountWithID('camera.last_frame_front_b');
      const image = await other.waitForSelector<HTMLImageElement>('img');
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(image.src).toContain('iris-screensaver');
    });

    it('should not show a frame older than its maximum age', async () => {
      const card = await mountLastFrame('camera.last_frame_old');
      await setFrame(card, {
        url: FRAME_URL,
        capturedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      });

      await new Promise((resolve) => setTimeout(resolve, 300));
      const image = await card.waitForSelector<HTMLImageElement>('img');
      expect(image.src).toContain('iris-screensaver');
      expect(deepQuery(card.card, '.last-frame-time')).toBeNull();
    });
  });
});
