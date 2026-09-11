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

const getHeadingLabel = (details: Element): Element => {
  const label = deepQuery(getHeading(details), 'span:not(.time)');
  assert(label);
  return label;
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

// Standard tier's label size (matches Home Assistant's body text).
const HEADING_SIZE = 14;

// The standard tier's detail size, as a fraction of the heading.
const METADATA_RATIO = 0.86;

// The line height at the default thumbnail size.
const STANDARD_LINE_HEIGHT = 1.25;

describe('AdvancedCameraCardThumbnailDetailsPanel', () => {
  afterEach(() => {
    document.body.style.removeProperty('line-height');
    document.documentElement.style.removeProperty('--ha-font-size-scale');
  });

  it('should match the dashboard body text at the default thumbnail size', async () => {
    const card = await mountGalleryWithThumbnailSize(THUMBNAIL_SIZE_DEFAULT);

    expect(getFontSize(getHeadingLabel(getDetails(card)))).toBeCloseTo(
      HEADING_SIZE,
      PIXEL_PRECISION,
    );
  });

  it('should follow the font scaling the dashboard is set to', async () => {
    document.documentElement.style.setProperty('--ha-font-size-scale', '2');

    const card = await mountGalleryWithThumbnailSize(THUMBNAIL_SIZE_DEFAULT);

    expect(getFontSize(getHeadingLabel(getDetails(card)))).toBeCloseTo(
      HEADING_SIZE * 2,
      PIXEL_PRECISION,
    );
  });

  it('should make the metadata text smaller than the heading', async () => {
    const card = await mountGalleryWithThumbnailSize(THUMBNAIL_SIZE_DEFAULT);
    const details = getDetails(card);

    expect(getFontSize(getMetadataRow(details))).toBeCloseTo(
      getFontSize(getHeadingLabel(details)) * METADATA_RATIO,
      PIXEL_PRECISION,
    );
  });

  it('should join the values onto one line with no icon beside them', async () => {
    const card = await mountGalleryWithThumbnailSize(THUMBNAIL_SIZE_DEFAULT);
    const row = getMetadataRow(getDetails(card));

    expect(deepQuery(row, 'advanced-camera-card-icon')).toBeNull();
    expect(row.textContent).toContain(' · ');
  });

  it('should show the start time in the heading, in the code font', async () => {
    const card = await mountGalleryWithThumbnailSize(THUMBNAIL_SIZE_DEFAULT);
    const details = getDetails(card);
    const time = deepQuery(getHeading(details), '.time');
    assert(time);

    expect(time.textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(getComputedStyle(time).fontFamily).toContain('monospace');
    expect(getComputedStyle(time).fontFamily).not.toBe(
      getComputedStyle(getMetadataRow(details)).fontFamily,
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

  it('should give a bigger thumbnail bigger text and more room between the lines', async () => {
    const smallest = await mountGalleryWithThumbnailSize(THUMBNAIL_SIZE_MIN);
    const largest = await mountGalleryWithThumbnailSize(THUMBNAIL_SIZE_MAX);

    const smallestHeading = getHeadingLabel(getDetails(smallest));
    const largestHeading = getHeadingLabel(getDetails(largest));

    // `lineHeight` computes to pixels. Dividing by the font size recovers the
    // multiplier the tier set.
    const leading = (element: Element): number =>
      parseFloat(getComputedStyle(element).lineHeight) / getFontSize(element);

    expect(getFontSize(largestHeading)).toBeGreaterThan(getFontSize(smallestHeading));
    expect(leading(largestHeading)).toBeGreaterThan(leading(smallestHeading));
  });

  it('should scale the time up more than the heading beside it', async () => {
    const smallest = getDetails(await mountGalleryWithThumbnailSize(THUMBNAIL_SIZE_MIN));
    const largest = getDetails(await mountGalleryWithThumbnailSize(THUMBNAIL_SIZE_MAX));

    const timeToHeading = (details: Element): number => {
      const time = deepQuery(getHeading(details), '.time');
      assert(time);
      return getFontSize(time) / getFontSize(getHeadingLabel(details));
    };

    expect(timeToHeading(largest)).toBeGreaterThan(timeToHeading(smallest));
  });

  it.each([[THUMBNAIL_SIZE_MIN], [THUMBNAIL_SIZE_MAX]])(
    'should show no more-details chip at size %s, because every value fits',
    async (size) => {
      const details = getDetails(await mountGalleryWithThumbnailSize(size));

      expect(getMetadataRow(details)).not.toBeNull();
      expect(deepQuery(details, 'ha-assist-chip.more')).toBeNull();
    },
  );
});
