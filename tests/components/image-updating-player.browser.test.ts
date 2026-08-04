import { describe, expect, it } from 'vitest';

import type { MediaLoadedInfoEventDetail } from '../../src/types';
import { MountedCardFactory, type MountedCard } from '../browser/mounted-card';
import {
  createStillCameraHASS,
  createStillImageCardConfig,
  isMediaLoadedInfoEventDetail,
  STILL_CAMERA_ENTITY,
} from '../browser/test-utils';

const UNRELATED_ENTITY = 'input_boolean.unrelated';

// The size of the static image fixture the player loads. Everything downstream
// sizes the card from what the player measured, so these are read from the
// media rather than declared anywhere in the configuration.
const FIXTURE_WIDTH = 320;
const FIXTURE_HEIGHT = 180;

interface RenderedElement extends Element {
  updateComplete: Promise<boolean>;
}

const mount = async (): Promise<MountedCard> => {
  const hass = createStillCameraHASS({ entities: { [UNRELATED_ENTITY]: 'off' } });
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

    const player = await card.waitForSelector<RenderedElement>(
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
    expect(loads[0].info.targetID).toBe(STILL_CAMERA_ENTITY);
  });

  it('should announce the size of the media itself', async () => {
    const card = await mount();

    await card.events.waitForFirst('advanced-camera-card:media:loaded');

    const [load] = getMediaLoadedInfos(card);
    expect(load.info.width).toBe(FIXTURE_WIDTH);
    expect(load.info.height).toBe(FIXTURE_HEIGHT);
  });
});
