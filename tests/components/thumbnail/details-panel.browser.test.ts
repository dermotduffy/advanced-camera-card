import { afterEach, assert, describe, expect, it } from 'vitest';

import {
  THUMBNAIL_SIZE_DEFAULT,
  THUMBNAIL_SIZE_MAX,
  THUMBNAIL_SIZE_MIN,
} from '../../../src/config/schema/common/controls/thumbnails';
import { deepQuery, deepQueryAll } from '../../browser/dom';
import {
  createTestFrigateEvent,
  EVENT_TIME_NEWER,
  mountCardWithFrigate,
} from '../../browser/fake-frigate';
import type { MountedCard } from '../../browser/mounted-card';
import { waitForThumbnails } from '../../browser/test-utils';

const mountGalleryWithThumbnailSize = async (size: number): Promise<MountedCard> => {
  const { card } = await mountCardWithFrigate(
    [createTestFrigateEvent('event', EVENT_TIME_NEWER)],
    {
      view: { default: 'clips' },
      media_gallery: { controls: { thumbnails: { size, details_style: 'panel' } } },
    },
  );
  await waitForThumbnails(card, 1);
  return card;
};

const getDetails = (card: MountedCard): Element => {
  const details = deepQuery(card.card, 'advanced-camera-card-thumbnail-details-panel');
  assert(details);
  return details;
};

const getHeading = (details: Element): Element => {
  const heading = deepQuery(details, 'div.heading');
  assert(heading);
  return heading;
};

const getMetadataRow = (details: Element): Element => {
  const row = deepQueryAll(details, 'div').find(
    (div) => !div.classList.contains('heading'),
  );
  assert(row);
  return row;
};

const getFontSize = (element: Element): number =>
  parseFloat(getComputedStyle(element).fontSize);

// Compare within 1/10th of a pixel.
const PIXEL_PRECISION = 1;

const HEADING_SIZE = 14;
const METADATA_RATIO = 0.8;

// The line height at the default thumbnail size.
const STANDARD_LINE_HEIGHT = 1.25;

describe('AdvancedCameraCardThumbnailDetailsPanel', () => {
  afterEach(() => {
    document.body.style.removeProperty('line-height');
    document.documentElement.style.removeProperty('--ha-font-size-scale');
  });

  it('should size the heading independently of the thumbnail size', async () => {
    const smallest = await mountGalleryWithThumbnailSize(THUMBNAIL_SIZE_MIN);
    expect(getFontSize(getHeading(getDetails(smallest)))).toBeCloseTo(
      HEADING_SIZE,
      PIXEL_PRECISION,
    );

    const largest = await mountGalleryWithThumbnailSize(THUMBNAIL_SIZE_MAX);
    expect(getFontSize(getHeading(getDetails(largest)))).toBeCloseTo(
      HEADING_SIZE,
      PIXEL_PRECISION,
    );
  });

  it('should follow the font scaling the dashboard is set to', async () => {
    document.documentElement.style.setProperty('--ha-font-size-scale', '2');

    const card = await mountGalleryWithThumbnailSize(THUMBNAIL_SIZE_DEFAULT);

    expect(getFontSize(getHeading(getDetails(card)))).toBeCloseTo(
      HEADING_SIZE * 2,
      PIXEL_PRECISION,
    );
  });

  it('should make the metadata text smaller than the heading', async () => {
    const card = await mountGalleryWithThumbnailSize(THUMBNAIL_SIZE_DEFAULT);
    const details = getDetails(card);

    expect(getFontSize(getMetadataRow(details))).toBeCloseTo(
      getFontSize(getHeading(details)) * METADATA_RATIO,
      PIXEL_PRECISION,
    );
  });

  it('should size each icon to match the text beside it', async () => {
    const card = await mountGalleryWithThumbnailSize(THUMBNAIL_SIZE_DEFAULT);
    const row = getMetadataRow(getDetails(card));

    const icon = deepQuery(row, 'advanced-camera-card-icon');
    assert(icon);

    expect(parseFloat(getComputedStyle(icon).width)).toBeCloseTo(
      getFontSize(row),
      PIXEL_PRECISION,
    );
  });

  it('should ignore a line height inherited from the page', async () => {
    document.body.style.setProperty('line-height', '3');

    const card = await mountGalleryWithThumbnailSize(THUMBNAIL_SIZE_DEFAULT);
    const heading = getHeading(getDetails(card));

    expect(parseFloat(getComputedStyle(heading).lineHeight)).toBeCloseTo(
      getFontSize(heading) * STANDARD_LINE_HEIGHT,
      PIXEL_PRECISION,
    );
  });

  it('should give a bigger thumbnail more space between rows, not bigger text', async () => {
    const smallest = await mountGalleryWithThumbnailSize(THUMBNAIL_SIZE_MIN);
    const largest = await mountGalleryWithThumbnailSize(THUMBNAIL_SIZE_MAX);

    const smallestHeading = getHeading(getDetails(smallest));
    const largestHeading = getHeading(getDetails(largest));

    expect(getFontSize(largestHeading)).toBeCloseTo(
      getFontSize(smallestHeading),
      PIXEL_PRECISION,
    );
    expect(parseFloat(getComputedStyle(largestHeading).lineHeight)).toBeGreaterThan(
      parseFloat(getComputedStyle(smallestHeading).lineHeight),
    );
  });

  describe('more details chip', () => {
    it('should be labeled with the number of rows left over', async () => {
      const card = await mountGalleryWithThumbnailSize(THUMBNAIL_SIZE_MIN);

      // `ha-assist-chip` takes its label as a property rather than an attribute.
      const chip = deepQuery<HTMLElement & { label?: string }>(
        getDetails(card),
        'ha-assist-chip.more',
      );
      assert(chip);
      expect(chip.label).toBe('+2 details');
    });

    it('should be omitted when every row fits', async () => {
      const card = await mountGalleryWithThumbnailSize(THUMBNAIL_SIZE_MAX);
      const details = getDetails(card);

      expect(getMetadataRow(details)).not.toBeNull();
      expect(deepQuery(details, 'ha-assist-chip.more')).toBeNull();
    });

    it('should open the media info popup when clicked', async () => {
      const card = await mountGalleryWithThumbnailSize(THUMBNAIL_SIZE_MIN);

      const chip = deepQuery<HTMLElement>(getDetails(card), 'ha-assist-chip.more');
      assert(chip);
      chip.click();

      const notification = await card.waitForRender(
        () => deepQuery(card.card, 'advanced-camera-card-notification'),
        'the media info popup',
      );
      expect(notification).not.toBeNull();
    });
  });
});
