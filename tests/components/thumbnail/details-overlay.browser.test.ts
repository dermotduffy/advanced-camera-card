import { assert, describe, expect, it } from 'vitest';

import type { ThumbnailDetailsStyle } from '../../../src/config/schema/common/controls/thumbnails';
import { deepQuery } from '../../browser/dom';
import {
  createTestFrigateEvent,
  EVENT_TIME_NEWER,
  mountCardWithFrigate,
} from '../../browser/fake-frigate';
import type { MountedCard } from '../../browser/mounted-card';
import { waitForThumbnails } from '../../browser/test-utils';

const mountGallery = async (
  detailsStyle: ThumbnailDetailsStyle,
  size: number,
): Promise<MountedCard> => {
  const { card } = await mountCardWithFrigate(
    [createTestFrigateEvent('event', EVENT_TIME_NEWER)],
    {
      view: { default: 'clips' },
      media_gallery: {
        controls: { thumbnails: { size, details_style: detailsStyle } },
      },
    },
  );
  await waitForThumbnails(card, 1);
  return card;
};

const getOverlay = (card: MountedCard): Element | null =>
  deepQuery(card.card, 'advanced-camera-card-thumbnail-details-overlay');

describe('AdvancedCameraCardThumbnailDetailsOverlay', () => {
  it('should render an overlay for the overlay style', async () => {
    const card = await mountGallery('overlay', 100);

    const overlay = getOverlay(card);
    assert(overlay);
    expect(overlay.getAttribute('tier')).toBe('standard');
    expect(deepQuery(overlay, '.details')).not.toBeNull();
  });

  it('should render an overlay for the hover style', async () => {
    const card = await mountGallery('hover', 100);

    const overlay = getOverlay(card);
    assert(overlay);
    expect(deepQuery(overlay, '.details')).not.toBeNull();
  });

  it('should render no overlay for the panel style', async () => {
    const card = await mountGallery('panel', 100);

    expect(getOverlay(card)).toBeNull();
    expect(
      deepQuery(card.card, 'advanced-camera-card-thumbnail-details-panel'),
    ).not.toBeNull();
  });

  it('should render no overlay when details are off', async () => {
    const card = await mountGallery('none', 100);

    expect(getOverlay(card)).toBeNull();
  });

  it('should move the label out of the smallest permanent overlay', async () => {
    const card = await mountGallery('overlay', 75);

    const overlay = getOverlay(card);
    assert(overlay);
    expect(overlay.getAttribute('tier')).toBe('compact');
    expect(deepQuery(overlay, '.corner-label')).not.toBeNull();
    expect(deepQuery(overlay, '.label')).toBeNull();
  });

  it('should keep the label in the overlay at a larger size', async () => {
    const card = await mountGallery('overlay', 300);

    const overlay = getOverlay(card);
    assert(overlay);
    expect(overlay.getAttribute('tier')).toBe('poster');
    expect(deepQuery(overlay, '.corner-label')).toBeNull();
    expect(deepQuery(overlay, '.label')).not.toBeNull();
  });

  it('should hide the overlay until the thumbnail is hovered', async () => {
    const card = await mountGallery('hover', 100);

    const overlay = getOverlay(card);
    assert(overlay);
    const details = deepQuery(overlay, '.details');
    assert(details);

    expect(getComputedStyle(details).opacity).toBe('0');
  });

  it('should show the overlay at rest when it is permanent', async () => {
    const card = await mountGallery('overlay', 100);

    const overlay = getOverlay(card);
    assert(overlay);
    const details = deepQuery(overlay, '.details');
    assert(details);

    expect(getComputedStyle(details).opacity).toBe('1');
  });

  it('should not intercept a click on the media', async () => {
    const card = await mountGallery('overlay', 100);

    const overlay = getOverlay(card);
    assert(overlay);

    expect(getComputedStyle(overlay).pointerEvents).toBe('none');
  });
});
