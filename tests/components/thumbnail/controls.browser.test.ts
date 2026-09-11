import { assert, describe, expect, it } from 'vitest';

import { clickElement, deepQuery, hoverElement } from '../../browser/dom';
import {
  createTestFrigateEvent,
  EVENT_TIME_NEWER,
  mountCardWithFrigate,
} from '../../browser/fake-frigate';
import type { MountedCard } from '../../browser/mounted-card';
import { getThumbnails, waitForThumbnails } from '../../browser/test-utils';

const mountGallery = async (favorite?: boolean): Promise<MountedCard> => {
  const { card } = await mountCardWithFrigate(
    [
      {
        ...createTestFrigateEvent('event', EVENT_TIME_NEWER),
        retain_indefinitely: favorite,
      },
    ],
    {
      view: { default: 'clips' },
      media_gallery: {
        controls: {
          thumbnails: {
            size: 200,
            details_style: 'overlay',
            show_favorite_control: true,
            show_info_control: true,
            show_timeline_control: true,
          },
        },
      },
    },
  );
  await waitForThumbnails(card, 1);
  return card;
};

const getControls = (card: MountedCard): Element => {
  const controls = deepQuery(
    getThumbnails(card.card)[0],
    'advanced-camera-card-thumbnail-controls',
  );
  assert(controls);
  return controls;
};

const getOpacity = (element: Element | null): number => {
  assert(element);
  return parseFloat(getComputedStyle(element).opacity);
};

describe('AdvancedCameraCardThumbnailControls', () => {
  it('should hide the controls until the thumbnail is hovered', async () => {
    const card = await mountGallery();
    const controls = getControls(card);

    expect(getOpacity(deepQuery(controls, 'advanced-camera-card-icon.info'))).toBe(0);
    expect(getOpacity(deepQuery(controls, '.controls'))).toBe(1);
  });

  it('should show the controls once the thumbnail is hovered', async () => {
    const card = await mountGallery();
    const thumbnail = getThumbnails(card.card)[0];
    const info = deepQuery(getControls(card), 'advanced-camera-card-icon.info');
    assert(info);

    const shown = new Promise<void>((resolve) =>
      info.addEventListener('transitionend', () => resolve(), { once: true }),
    );
    await hoverElement(thumbnail);
    await shown;

    expect(getOpacity(info)).toBe(1);
  });

  it('should show the controls when the thumbnail takes keyboard focus', async () => {
    const card = await mountGallery();
    const thumbnail = getThumbnails(card.card)[0];

    const isRevealed = (): string =>
      getComputedStyle(thumbnail)
        .getPropertyValue('--advanced-camera-card-thumbnail-revealed')
        .trim();

    expect(isRevealed()).toBe('0');

    thumbnail.focus();

    expect(isRevealed()).toBe('1');
  });

  it('should not leave the controls showing after one of them is clicked', async () => {
    const card = await mountGallery();
    const thumbnail = getThumbnails(card.card)[0];
    const favorite = deepQuery<HTMLElement>(
      getControls(card),
      'advanced-camera-card-icon.favorite',
    );
    assert(favorite);

    await clickElement(favorite);

    expect(thumbnail.matches(':focus-within')).toBe(false);
  });

  it('should keep a control on show at rest when its state is set', async () => {
    const card = await mountGallery(true);
    const controls = getControls(card);

    const favorite = deepQuery(controls, 'advanced-camera-card-icon.favorite');
    assert(favorite);
    expect(favorite.classList.contains('active')).toBe(true);
    expect(getOpacity(favorite)).toBe(1);

    expect(getOpacity(deepQuery(controls, 'advanced-camera-card-icon.info'))).toBe(0);
  });

  it('should park every control but the first past the trailing edge', async () => {
    const card = await mountGallery(true);
    const thumbnail = getThumbnails(card.card)[0];
    const controls = getControls(card);

    const favorite = deepQuery(controls, 'advanced-camera-card-icon.favorite');
    const info = deepQuery(controls, 'advanced-camera-card-icon.info');
    assert(favorite && info);

    const thumbnailRect = thumbnail.getBoundingClientRect();

    // The favorite is the control that reports a state, so it is the one left
    // visible.
    expect(favorite.getBoundingClientRect().right).toBeLessThanOrEqual(
      thumbnailRect.right,
    );

    // Everything behind it is clipped.
    expect(info.getBoundingClientRect().right).toBeGreaterThan(thumbnailRect.right);
  });

  it('should render no row at all for an item with no controls', async () => {
    const { card } = await mountCardWithFrigate(
      [createTestFrigateEvent('event', EVENT_TIME_NEWER)],
      {
        view: { default: 'clips' },
        media_gallery: {
          controls: {
            thumbnails: {
              size: 200,
              show_favorite_control: false,
              show_info_control: false,
              show_timeline_control: false,
              show_download_control: false,
              show_review_control: false,
            },
          },
        },
      },
    );
    await waitForThumbnails(card, 1);

    expect(deepQuery(getControls(card), '.controls')).toBeNull();
  });
});
