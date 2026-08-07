import { describe, expect, it } from 'vitest';

import type { FrigateEvent } from '../../../src/camera-manager/frigate/types';
import type { PartialAdvancedCameraCardConfig } from '../../../src/config/types';
import { deepQuery } from '../../browser/dom';
import {
  createTestFrigateEvent,
  EVENT_TIME_NEWER,
  EVENT_TIME_OLDER,
  mountCardWithFrigate,
} from '../../browser/fake-frigate';
import type { MountedCard } from '../../browser/mounted-card';
import {
  clickThumbnail,
  getBlockNotificationText,
  getMediaViewerMediaURLs,
  getThumbnails,
  waitForThumbnails,
} from '../../browser/test-utils';

const NO_MEDIA_TEXT = 'No media to display';

const mountCard = async (
  events: FrigateEvent[],
  config?: PartialAdvancedCameraCardConfig,
): Promise<MountedCard> =>
  (await mountCardWithFrigate(events, { view: { default: 'clips' }, ...config })).card;

describe('AdvancedCameraCardGallery', () => {
  it('should show a thumbnail for every event the camera detected', async () => {
    const card = await mountCard([
      createTestFrigateEvent('older', EVENT_TIME_OLDER),
      createTestFrigateEvent('newer', EVENT_TIME_NEWER),
    ]);

    await waitForThumbnails(card, 2);

    expect(getThumbnails(card.card)).toHaveLength(2);
  });

  it('should show the picture Frigate has of each event', async () => {
    const card = await mountCard([createTestFrigateEvent('newer', EVENT_TIME_NEWER)]);

    await waitForThumbnails(card, 1);
    const thumbnail = getThumbnails(card.card)[0];

    // A thumbnail that never arrives is drawn as an icon and nothing else says
    // so, so counting thumbnails says nothing about whether there is a picture
    // in them. The card fetches one with the user's credentials and embeds what
    // comes back, which is why the result is a data URL rather than the path
    // asked for.
    const image = await card.waitForRender(
      () => deepQuery<HTMLImageElement>(thumbnail, 'img'),
      'the thumbnail picture',
    );

    expect(image.src).toMatch(/^data:image\/png/);
  });

  it('should say there is nothing to view when the camera has no events', async () => {
    const card = await mountCard([]);

    // The element renders before its text, so waiting for the element alone can
    // read it while it is still empty.
    await card.waitForRender(
      () => getBlockNotificationText(card.card).includes(NO_MEDIA_TEXT) || null,
      `the "${NO_MEDIA_TEXT}" notification`,
    );

    expect(getThumbnails(card.card)).toHaveLength(0);
  });

  it('should open the clips gallery from the live view', async () => {
    const card = await mountCard([createTestFrigateEvent('newer', EVENT_TIME_NEWER)], {
      view: { default: 'live' },

      // The clips button is hidden by default.
      menu: { style: 'outside', buttons: { clips: { enabled: true } } },
    });

    await card.events.waitForFirst('advanced-camera-card:media:loaded');

    await card.clickControl('Clips gallery');
    await card.waitForSelector('advanced-camera-card-gallery');

    await waitForThumbnails(card, 1);
    expect(getThumbnails(card.card)).toHaveLength(1);
  });

  it('should open the viewer on the media that was clicked', async () => {
    const card = await mountCard([
      createTestFrigateEvent('older', EVENT_TIME_OLDER),
      createTestFrigateEvent('newer', EVENT_TIME_NEWER),
    ]);

    await waitForThumbnails(card, 2);

    // The newest event is shown first, so index 1 is the older of the two.
    await clickThumbnail(card.card, 1);
    await card.events.waitForFirst('advanced-camera-card:media:loaded');

    await card.waitForSelector('advanced-camera-card-viewer-carousel');

    expect(getMediaViewerMediaURLs(card.card)).toEqual([
      expect.stringContaining('clip.webm?event=older'),
    ]);
  });

  it('should show the media filter', async () => {
    const card = await mountCard([createTestFrigateEvent('newer', EVENT_TIME_NEWER)]);

    await card.waitForSelector('advanced-camera-card-media-filter');

    expect(deepQuery(card.card, 'advanced-camera-card-media-filter')).not.toBeNull();
  });

  it('should not show the media filter when its mode is none', async () => {
    const card = await mountCard([createTestFrigateEvent('newer', EVENT_TIME_NEWER)], {
      media_gallery: { controls: { filter: { mode: 'none' } } },
    });

    await waitForThumbnails(card, 1);

    // The gallery still renders, so a missing filter is not a missing gallery.
    expect(deepQuery(card.card, 'advanced-camera-card-gallery')).not.toBeNull();
    expect(deepQuery(card.card, 'advanced-camera-card-media-filter')).toBeNull();
  });
});
