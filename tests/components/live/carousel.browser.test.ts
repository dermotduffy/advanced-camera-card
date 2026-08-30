import { assert, describe, expect, it } from 'vitest';

import { deepQuery } from '../../browser/dom';
import { MountedCardFactory } from '../../browser/mounted-card';
import {
  createGenericCameraHASS,
  createStillImageCardConfig,
} from '../../browser/test-utils';

describe('AdvancedCameraCardLiveCarousel', () => {
  it('should cap its own height to fit the media it shows', async () => {
    const card = await MountedCardFactory.createFromSource(
      createStillImageCardConfig(),
      createGenericCameraHASS(),
    );
    await card.events.waitForFirst('advanced-camera-card:media:loaded');

    const carousel = deepQuery<HTMLElement>(
      card.card,
      'advanced-camera-card-live-carousel',
    );
    assert(carousel);

    await card.waitForRender(
      () => carousel.style.maxHeight || null,
      'the carousel capping its own height',
    );

    // Outside a grid the carousel fills the card, so the cap is what gives the
    // card the height of its media rather than of whatever contains it.
    expect(parseFloat(carousel.style.maxHeight)).toBe(
      carousel.getBoundingClientRect().height,
    );
  });
});
