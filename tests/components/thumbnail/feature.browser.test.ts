import { assert, describe, expect, it } from 'vitest';

import type { FrigateReview } from '../../../src/camera-manager/frigate/types';
import type { CameraMediaReviewedFilter } from '../../../src/config/schema/cameras';
import { clickElement, deepQuery, hoverElement } from '../../browser/dom';
import {
  createTestFrigateEvent,
  createTestFrigateReview,
  EVENT_TIME_NEWER,
  EVENT_TIME_OLDER,
  mountCardWithFrigate,
} from '../../browser/fake-frigate';
import type { MountedCard } from '../../browser/mounted-card';
import {
  clickThumbnail,
  createStillImageCameraConfig,
  getThumbnails,
  setMediaFilter,
  waitForThumbnails,
} from '../../browser/test-utils';

const REVIEW_ID = 'review-1';

const mountCardWithReview = async (
  reviewedFilter: CameraMediaReviewedFilter = 'unreviewed',
  review?: Partial<FrigateReview>,
): Promise<MountedCard> => {
  const { card } = await mountCardWithFrigate(
    [],
    {
      view: { default: 'reviews' },
      cameras: [
        { ...createStillImageCameraConfig(), media: { reviewed: reviewedFilter } },
      ],
      menu: { style: 'outside' },
    },
    [createTestFrigateReview(REVIEW_ID, EVENT_TIME_NEWER, review)],
  );

  await waitForThumbnails(card, 1);
  return card;
};

const getNotificationControl = (
  card: MountedCard,
  title: string,
): HTMLElement | null => {
  const notification = deepQuery(card.card, 'advanced-camera-card-notification');
  return notification
    ? deepQuery<HTMLElement>(notification, `[title="${title}"]`)
    : null;
};

const getReviewControl = (card: MountedCard): HTMLElement => {
  const control = deepQuery<HTMLElement>(
    getThumbnails(card.card)[0],
    'advanced-camera-card-icon.review',
  );
  if (!control) {
    throw new Error('The thumbnail has no review control');
  }
  return control;
};

const getFavoriteControls = (card: MountedCard): HTMLElement[] =>
  getThumbnails(card.card).map((thumbnail) => {
    const control = deepQuery<HTMLElement>(
      thumbnail,
      'advanced-camera-card-icon.favorite',
    );
    if (!control) {
      throw new Error('The thumbnail has no favorite control');
    }
    return control;
  });

describe('AdvancedCameraCardThumbnailFeature', () => {
  it('should dim the picture of a reviewed item', async () => {
    const opacity = async (hasBeenReviewed: boolean): Promise<number> => {
      const card = await mountCardWithReview('all', {
        has_been_reviewed: hasBeenReviewed,
      });
      const media = deepQuery(getThumbnails(card.card)[0], '.media');
      assert(media);
      return parseFloat(getComputedStyle(media).opacity);
    };

    expect(await opacity(true)).toBeLessThan(await opacity(false));
  });

  it('should show the check effect when an item is reviewed from its thumbnail', async () => {
    const card = await mountCardWithReview();

    expect(deepQuery(card.card, 'advanced-camera-card-effect-check')).toBeNull();

    await hoverElement(getThumbnails(card.card)[0]);
    await clickElement(getReviewControl(card));

    await card.waitForSelector('advanced-camera-card-effect-check');
    expect(deepQuery(card.card, 'advanced-camera-card-effect-check')).not.toBeNull();
  });

  it('should show the check effect when an item is reviewed from its info notification', async () => {
    const card = await mountCardWithReview();

    const info = deepQuery<HTMLElement>(
      getThumbnails(card.card)[0],
      'advanced-camera-card-icon.info',
    );
    assert(info);
    await hoverElement(getThumbnails(card.card)[0]);
    await clickElement(info);

    const control = await card.waitForRender(
      () => getNotificationControl(card, 'Mark as reviewed'),
      'the review control on the notification',
    );
    await clickElement(control);

    await card.waitForSelector('advanced-camera-card-effect-check');
    expect(deepQuery(card.card, 'advanced-camera-card-effect-check')).not.toBeNull();
  });

  it('should mark the control as reviewed when an item is reviewed from its thumbnail', async () => {
    // A gallery of unreviewed items drops an item the moment it is reviewed,
    // need to show both reviewed/unreviewed.
    const card = await mountCardWithReview('all');

    expect(getReviewControl(card).classList.contains('active')).toBe(false);

    await hoverElement(getThumbnails(card.card)[0]);
    await clickElement(getReviewControl(card));

    await card.waitForRender(
      () => (getReviewControl(card).classList.contains('active') ? true : null),
      'a reviewed review control',
    );
  });

  it('should mark the thumbnail as reviewed from the menu button', async () => {
    const { card } = await mountCardWithFrigate(
      [],
      {
        view: { default: 'reviews' },
        cameras: [{ ...createStillImageCameraConfig(), media: { reviewed: 'all' } }],
        menu: { style: 'outside' },
        media_viewer: { controls: { thumbnails: { mode: 'below' } } },
      },
      [createTestFrigateReview(REVIEW_ID, EVENT_TIME_NEWER)],
    );
    await waitForThumbnails(card, 1);
    await clickThumbnail(card.card, 0);

    const button = await card.findControl('Mark as reviewed');
    expect(getReviewControl(card).classList.contains('active')).toBe(false);

    await clickElement(button);

    await card.waitForRender(
      () => (getReviewControl(card).classList.contains('active') ? true : null),
      'a reviewed review control on the thumbnail',
    );
  });

  it('should fill the thumbnail star when an item is favorited', async () => {
    const { card } = await mountCardWithFrigate(
      [createTestFrigateEvent('event-1', EVENT_TIME_NEWER)],
      { view: { default: 'clips' }, menu: { style: 'outside' } },
    );
    await waitForThumbnails(card, 1);

    const isStarred = (): boolean =>
      getFavoriteControls(card)[0].classList.contains('active');

    expect(isStarred()).toBe(false);

    const info = deepQuery<HTMLElement>(
      getThumbnails(card.card)[0],
      'advanced-camera-card-icon.info',
    );
    assert(info);
    await hoverElement(getThumbnails(card.card)[0]);
    await clickElement(info);

    const star = await card.waitForRender(
      () => getNotificationControl(card, 'Retain media indefinitely'),
      'the favorite control on the notification',
    );
    await clickElement(star);

    await card.waitForRender(
      () => (isStarred() ? true : null),
      'a starred favorite control on the thumbnail',
    );
  });

  it('should remove an un-favorited item from a favorites-only gallery', async () => {
    const { card } = await mountCardWithFrigate(
      [
        createTestFrigateEvent('favorite-1', EVENT_TIME_NEWER, {
          retain_indefinitely: true,
        }),
        createTestFrigateEvent('favorite-2', EVENT_TIME_OLDER, {
          retain_indefinitely: true,
        }),
        createTestFrigateEvent('plain', EVENT_TIME_OLDER - 1),
      ],
      { view: { default: 'clips' }, menu: { style: 'outside' } },
    );
    await waitForThumbnails(card, 3);

    await setMediaFilter(card, 'Favorite', 'favorite');
    await waitForThumbnails(card, 2);

    await hoverElement(getThumbnails(card.card)[0]);
    await clickElement(getFavoriteControls(card)[0]);

    await waitForThumbnails(card, 1);
  });
});
