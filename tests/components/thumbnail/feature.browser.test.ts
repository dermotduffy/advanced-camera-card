import { assert, describe, expect, it } from 'vitest';

import type { CameraMediaReviewedFilter } from '../../../src/config/schema/cameras';
import { clickElement, deepQuery } from '../../browser/dom';
import {
  createTestFrigateReview,
  EVENT_TIME_NEWER,
  mountCardWithFrigate,
} from '../../browser/fake-frigate';
import type { MountedCard } from '../../browser/mounted-card';
import {
  createStillImageCameraConfig,
  getThumbnails,
  waitForThumbnails,
} from '../../browser/test-utils';

const REVIEW_ID = 'review-1';

const mountCardWithReview = async (
  reviewed: CameraMediaReviewedFilter = 'unreviewed',
): Promise<MountedCard> => {
  const { card } = await mountCardWithFrigate(
    [],
    {
      view: { default: 'reviews' },
      cameras: [{ ...createStillImageCameraConfig(), media: { reviewed } }],
      menu: { style: 'outside' },
    },
    [createTestFrigateReview(REVIEW_ID, EVENT_TIME_NEWER)],
  );

  await waitForThumbnails(card, 1);
  return card;
};

const getNotificationReviewControl = (card: MountedCard): HTMLElement | null => {
  const notification = deepQuery(card.card, 'advanced-camera-card-notification');
  return notification
    ? deepQuery<HTMLElement>(notification, '[title="Mark as reviewed"]')
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

describe('AdvancedCameraCardThumbnailFeature', () => {
  it('should show the check effect when an item is reviewed from its thumbnail', async () => {
    const card = await mountCardWithReview();

    expect(deepQuery(card.card, 'advanced-camera-card-effect-check')).toBeNull();

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
    await clickElement(info);

    const control = await card.waitForRender(
      () => getNotificationReviewControl(card),
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

    expect(getReviewControl(card).classList.contains('reviewed')).toBe(false);

    await clickElement(getReviewControl(card));

    await card.waitForRender(
      () => (getReviewControl(card).classList.contains('reviewed') ? true : null),
      'a reviewed review control',
    );
  });
});
