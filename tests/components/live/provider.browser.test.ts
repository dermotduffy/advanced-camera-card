import type { LitElement } from 'lit';
import { afterEach, assert, describe, expect, it, vi } from 'vitest';

import { LIVENESS_ENTITY_UNAVAILABLE_GRACE_SECONDS } from '../../../src/components-lib/live/liveness/detectors/entity-availability';
import type { RawAdvancedCameraCardConfig } from '../../../src/config/types';
import type { DataURL } from '../../../src/types';
import { aspectRatioToString, formatDateAndTime } from '../../../src/utils/basic';
import { isDataURL } from '../../../src/utils/data-url';
import { sharedPreservedFrameStore } from '../../../src/utils/preserved-frame-store';
import { deepQuery } from '../../browser/dom';
import { createFixtureURL, SNAPSHOT_FIXTURE_FILENAME } from '../../browser/fixtures';
import { MountedCardFactory, type MountedCard } from '../../browser/mounted-card';
import { createUnansweredMediaURL, useTestMedia } from '../../browser/test-media';
import {
  CAMERA_ENTITY,
  createGenericCameraHASS,
  createStillImageCardConfig,
  getStatusBarStrings,
} from '../../browser/test-utils';

useTestMedia();

const IMAGE_URL = createFixtureURL(SNAPSHOT_FIXTURE_FILENAME);

const DEFAULT_RATIO = [16, 9];
const DEFAULT_RATIO_STYLE = aspectRatioToString({ ratio: DEFAULT_RATIO });

const PORTRAIT_RATIO = [9, 16];
const PORTRAIT_RATIO_STYLE = aspectRatioToString({ ratio: PORTRAIT_RATIO });

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

// The provider writes `sized` during its own render, so its render is what a
// test has to wait for rather than that of the card that drew it.
const getProvider = async (card: MountedCard): Promise<LitElement> => {
  const provider = await card.waitForSelector<LitElement>(
    'advanced-camera-card-live-provider',
  );
  await provider.updateComplete;
  return provider;
};

const getReservedAspectRatio = (provider: Element): string =>
  getComputedStyle(provider).aspectRatio;

const getMeasuredAspectRatio = (element: Element): number => {
  const { width, height } = element.getBoundingClientRect();
  return width / height;
};

// A browser lays a box out in fractional pixels, so a measurement never divides
// back to exactly the ratio it was given.
const expectMeasuredAspectRatio = (element: Element, ratio: number[]): void =>
  expect(getMeasuredAspectRatio(element)).toBeCloseTo(ratio[0] / ratio[1], 2);

const waitForMeasuredAspectRatio = async (
  card: MountedCard,
  ratio: number[],
): Promise<void> => {
  await card.waitForRender(
    () => {
      try {
        expectMeasuredAspectRatio(card.card, ratio);
        return true;
      } catch {
        return null;
      }
    },
    `the card being measured as ${aspectRatioToString({ ratio })}`,
  );
};

// The image the card's image player shows, if it shows one.
const getImage = (card: MountedCard): HTMLImageElement | null => {
  const player = deepQuery(card.card, 'advanced-camera-card-image-updating-player');
  return (player && deepQuery<HTMLImageElement>(player, 'img')) ?? null;
};

const getImageSource = (card: MountedCard): string | null => getImage(card)?.src ?? null;

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

  describe('should reserve an aspect ratio until the frame has a size', () => {
    it('should set default absent other information', async () => {
      const card = await mount({
        live_provider: 'image',
        image: { mode: 'url', url: createUnansweredMediaURL(), refresh_seconds: 0 },
      });

      const provider = await getProvider(card);

      expect(provider.hasAttribute('sized')).toBe(false);
      expect(getReservedAspectRatio(provider)).toBe(DEFAULT_RATIO_STYLE);

      // The reservation is what keeps the card off its 100px minimum height.
      expectMeasuredAspectRatio(card.card, DEFAULT_RATIO);
    });

    it('should reserve an aspect ratio when the placeholder snapshot is allowed but has not loaded', async () => {
      const card = await mount(
        {
          live_provider: 'image',
          image: { mode: 'url', url: createUnansweredMediaURL(), refresh_seconds: 0 },
        },
        { show_image_during_load: true },
      );

      const provider = await getProvider(card);

      // The image loading snapshot is on screen and is what would size the
      // frame, so its absence here is the image never being decoded rather than
      // never being asked for.
      expect(deepQuery(provider, 'advanced-camera-card-live-image')).not.toBeNull();
      expect(provider.hasAttribute('sized')).toBe(false);
      expect(getReservedAspectRatio(provider)).toBe(DEFAULT_RATIO_STYLE);
      expectMeasuredAspectRatio(card.card, DEFAULT_RATIO);
    });

    it('should size to the snapshot once it has loaded', async () => {
      const card = await mount(
        {
          live_provider: 'image',
          image: { mode: 'url', url: IMAGE_URL, refresh_seconds: 0 },
        },
        { show_image_during_load: true },
      );

      const provider = await getProvider(card);

      await card.waitForRender(
        () => provider.hasAttribute('sized') || null,
        'the frame being sized by the loaded snapshot',
      );

      expect(getReservedAspectRatio(provider)).toBe('auto');
    });

    it('should size to a configured camera aspect ratio', async () => {
      const card = await mount({
        live_provider: 'image',
        image: { mode: 'url', url: createUnansweredMediaURL(), refresh_seconds: 0 },
        dimensions: { aspect_ratio: PORTRAIT_RATIO_STYLE },
      });

      const provider = await getProvider(card);

      // The camera declares the shape of its media, so the media itself is
      // sized and must not be letterboxed into the reserved ratio.
      expect(provider.hasAttribute('sized')).toBe(true);
      expect(getReservedAspectRatio(provider)).toBe('auto');
      await waitForMeasuredAspectRatio(card, PORTRAIT_RATIO);
    });

    it('should reserve an aspect ratio again once a camera goes unavailable', async () => {
      const card = await mount({
        live_provider: 'image',
        image: { mode: 'url', url: IMAGE_URL, refresh_seconds: 0 },
        dimensions: { aspect_ratio: PORTRAIT_RATIO_STYLE },
      });

      const provider = await getProvider(card);
      await waitForMeasuredAspectRatio(card, PORTRAIT_RATIO);
      expect(provider.hasAttribute('sized')).toBe(true);

      vi.useFakeTimers();

      // This triggers a notification to be rendered in the default aspect
      // ratio.
      card.setEntityState(CAMERA_ENTITY, 'unavailable');
      await card.advanceSeconds(LIVENESS_ENTITY_UNAVAILABLE_GRACE_SECONDS);

      await card.waitForRender(
        () => !provider.hasAttribute('sized') || null,
        'the frame giving up its size',
      );
      expect(getReservedAspectRatio(provider)).toBe(DEFAULT_RATIO_STYLE);
      expectMeasuredAspectRatio(card.card, DEFAULT_RATIO);
    });
  });

  describe('should show the date of a preserved frame in the status bar', () => {
    it('should show the date while the frame is the loading image of another provider', async () => {
      const date = new Date();
      sharedPreservedFrameStore.set(
        { cameraID: 'loading-image' },
        { url: createPreservedFrameURL(), date },
      );

      const card = await mount(
        {
          id: 'loading-image',
          live_provider: 'go2rtc',
          go2rtc: { url: 'http://localhost:1984', stream: 'office' },
          proxy: { live: false },
          image: { refresh_seconds: 0, preserve_frame_seconds: 600 },
        },
        { show_image_during_load: true },
      );

      await card.waitForRender(
        () => getStatusBarStrings(card.card).includes(formatDateAndTime(date)) || null,
        'the status bar showing the date of the loading image',
      );
    });

    it('should show the date while the frame is the image of the image provider', async () => {
      const date = new Date();
      sharedPreservedFrameStore.set(
        { cameraID: 'image-provider' },
        { url: createPreservedFrameURL(), date },
      );

      const card = await mount({
        id: 'image-provider',
        live_provider: 'image',
        image: {
          mode: 'url',
          url: IMAGE_URL,
          refresh_seconds: 0,
          preserve_frame_seconds: 600,
        },
      });

      await card.waitForRender(
        () => getStatusBarStrings(card.card).includes(formatDateAndTime(date)) || null,
        'the status bar showing the date of the image',
      );
    });

    it('should show no date for a loading image that is not a preserved frame', async () => {
      const card = await mount(
        {
          id: 'snapshot',
          live_provider: 'go2rtc',
          go2rtc: { url: 'http://localhost:1984', stream: 'office' },
          proxy: { live: false },
          image: { mode: 'url', url: IMAGE_URL, refresh_seconds: 0 },
        },
        { show_image_during_load: true },
      );

      const provider = await getProvider(card);
      await card.waitForRender(
        () => provider.hasAttribute('sized') || null,
        'the loading image having loaded',
      );

      expect(getStatusBarStrings(card.card)).toEqual(['office']);
    });
  });

  it('should show the preserved frame once the card returns to the page', async () => {
    const card = await mount({
      id: 'returns',
      live_provider: 'image',
      image: {
        mode: 'url',
        url: IMAGE_URL,
        refresh_seconds: 0,
        preserve_frame_seconds: 600,
      },
    });
    const provider = await getProvider(card);
    await card.waitForRender(
      () => provider.hasAttribute('sized') || null,
      'the image having loaded',
    );
    expect(sharedPreservedFrameStore.get({ cameraID: 'returns' }, 600)).toBeNull();

    card.detach();

    const frame = await vi.waitFor(() => {
      const frame = sharedPreservedFrameStore.get({ cameraID: 'returns' }, 600);
      assert(frame);
      return frame;
    });

    card.attach();

    await card.waitForRender(
      () => getImageSource(card) === frame.url || null,
      'the image showing the preserved frame',
    );
    await card.waitForRender(
      () =>
        getStatusBarStrings(card.card).includes(formatDateAndTime(frame.date)) || null,
      'the status bar showing the date of the frame',
    );
  });

  it('should show the frame preserved as the page hides once the page is shown again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const card = await mount({
      id: 'page-hidden',
      live_provider: 'image',
      image: {
        mode: 'url',
        url: IMAGE_URL,
        refresh_seconds: 10,
        preserve_frame_seconds: 600,
      },
    });
    const provider = await getProvider(card);
    await card.waitForRender(
      () => provider.hasAttribute('sized') || null,
      'the image having loaded',
    );
    const image = getImage(card);
    assert(image);
    const refreshed = new Promise((resolve) =>
      image.addEventListener('load', resolve, { once: true }),
    );

    // At each refresh the image player dismisses the preserved frames captured
    // before that refresh, which must not include the frame captured later as
    // the page hides.
    await card.advanceSeconds(10);
    await refreshed;

    // The fake clock may not move by itself between these steps, and a frame
    // captured at the same instant as a refresh counts as dismissed -- avoid
    // this by advancing by 1 second.
    await card.advanceSeconds(1);

    card.setPageVisible(false);
    await card.advanceSeconds(1);
    const frame = sharedPreservedFrameStore.get({ cameraID: 'page-hidden' }, 600);
    assert(frame);

    card.setPageVisible(true);

    await card.waitForRender(
      () => getImageSource(card) === frame.url || null,
      'the image showing the preserved frame',
    );
  });

  describe('should replace a preserved frame at the first refresh of the image', () => {
    it('should replace the frame of the image provider', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const date = new Date();
      const frameURL = createPreservedFrameURL();
      sharedPreservedFrameStore.set(
        { cameraID: 'image-refresh' },
        { url: frameURL, date },
      );

      const card = await mount({
        id: 'image-refresh',
        live_provider: 'image',
        image: {
          mode: 'url',
          url: IMAGE_URL,
          refresh_seconds: 1,
          preserve_frame_seconds: 600,
        },
      });
      await card.waitForRender(
        () => getImageSource(card) === frameURL || null,
        'the image showing the preserved frame',
      );

      await card.advanceSeconds(1);

      await card.waitForRender(
        () => getImageSource(card)?.includes(SNAPSHOT_FIXTURE_FILENAME) || null,
        'the image showing its configured URL',
      );
      await card.waitForRender(
        () => !getStatusBarStrings(card.card).includes(formatDateAndTime(date)) || null,
        'the status bar no longer showing the date of the frame',
      );
    });

    it('should replace the frame of a loading image', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const frameURL = createPreservedFrameURL();
      sharedPreservedFrameStore.set(
        { cameraID: 'loading-refresh' },
        { url: frameURL, date: new Date() },
      );

      const card = await mount(
        {
          id: 'loading-refresh',
          live_provider: 'go2rtc',
          go2rtc: { url: 'http://localhost:1984', stream: 'office' },
          proxy: { live: false },
          image: {
            mode: 'url',
            url: IMAGE_URL,
            refresh_seconds: 1,
            preserve_frame_seconds: 600,
          },
        },
        { show_image_during_load: true },
      );
      await card.waitForRender(
        () => getImageSource(card) === frameURL || null,
        'the loading image showing the preserved frame',
      );

      await card.advanceSeconds(1);

      await card.waitForRender(
        () => getImageSource(card)?.includes(SNAPSHOT_FIXTURE_FILENAME) || null,
        'the loading image showing its configured URL',
      );
    });
  });

  it('should keep a preserved frame through refreshes of the default image', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const frameURL = createPreservedFrameURL();
    sharedPreservedFrameStore.set(
      { cameraID: 'default-refresh' },
      { url: frameURL, date: new Date() },
    );

    // The default image refreshes every second unless configured otherwise.
    const card = await mount(
      {
        id: 'default-refresh',
        live_provider: 'go2rtc',
        go2rtc: { url: 'http://localhost:1984', stream: 'office' },
        proxy: { live: false },
        image: { mode: 'default', preserve_frame_seconds: 600 },
      },
      { show_image_during_load: true },
    );
    await card.waitForRender(
      () => getImageSource(card) === frameURL || null,
      'the loading image showing the preserved frame',
    );
    const player = await card.waitForSelector<LitElement>(
      'advanced-camera-card-image-updating-player',
    );

    await card.advanceSeconds(1);
    await player.updateComplete;

    expect(getImageSource(card)).toBe(frameURL);
  });

  it('should keep showing the preserved frame of a camera without an entity while its stream loads', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const frameURL = createPreservedFrameURL();
    sharedPreservedFrameStore.set(
      { cameraID: 'no-entity' },
      { url: frameURL, date: new Date() },
    );

    // Without an entity the image falls back to the default image, which
    // refreshes every second.
    const card = await MountedCardFactory.createFromSource(
      createStillImageCardConfig({
        cameras: [
          {
            id: 'no-entity',
            live_provider: 'go2rtc',
            go2rtc: { url: 'http://localhost:1984', stream: 'office' },
            proxy: { live: false },
            image: { preserve_frame_seconds: 600 },
          },
        ],
        live: { show_image_during_load: true },
      }),
      createGenericCameraHASS(),
    );
    await card.waitForRender(
      () => getImageSource(card) === frameURL || null,
      'the loading image showing the preserved frame',
    );
    const player = await card.waitForSelector<LitElement>(
      'advanced-camera-card-image-updating-player',
    );

    await card.advanceSeconds(1);
    await player.updateComplete;

    expect(getImageSource(card)).toBe(frameURL);
  });

  it('should replace a preserved frame once it is too old', async () => {
    // The clock still runs by itself, so the card mounts as usual.
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const date = new Date();
    const frameURL = createPreservedFrameURL();
    sharedPreservedFrameStore.set({ cameraID: 'too-old' }, { url: frameURL, date });

    // The image never refreshes, so only the age of the frame can replace it.
    const card = await mount({
      id: 'too-old',
      live_provider: 'image',
      image: {
        mode: 'url',
        url: IMAGE_URL,
        refresh_seconds: 0,
        preserve_frame_seconds: 60,
      },
    });

    const player = await card.waitForSelector(
      'advanced-camera-card-image-updating-player',
    );
    const image = await card.waitForRender(
      () => deepQuery<HTMLImageElement>(player, 'img'),
      'the image being rendered',
    );
    await card.waitForRender(
      () => getStatusBarStrings(card.card).includes(formatDateAndTime(date)) || null,
      'the status bar showing the date of the image',
    );
    expect(image.src).toBe(frameURL);

    await card.advanceSeconds(60);

    await card.waitForRender(
      () => image.src.includes(SNAPSHOT_FIXTURE_FILENAME) || null,
      'the image showing its configured URL',
    );
    await card.waitForRender(
      () => !getStatusBarStrings(card.card).includes(formatDateAndTime(date)) || null,
      'the status bar no longer showing the date of the frame',
    );
  });
});
