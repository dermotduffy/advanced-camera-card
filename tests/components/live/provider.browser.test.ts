import type { LitElement } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LIVENESS_ENTITY_UNAVAILABLE_GRACE_SECONDS } from '../../../src/components-lib/live/liveness/detectors/entity-availability';
import type { RawAdvancedCameraCardConfig } from '../../../src/config/types';
import { aspectRatioToString } from '../../../src/utils/basic';
import { deepQuery } from '../../browser/dom';
import { createFixtureURL, SNAPSHOT_FIXTURE_FILENAME } from '../../browser/fixtures';
import { MountedCardFactory, type MountedCard } from '../../browser/mounted-card';
import { createUnansweredMediaURL, useTestMedia } from '../../browser/test-media';
import {
  CAMERA_ENTITY,
  createGenericCameraHASS,
  createStillImageCardConfig,
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
});
