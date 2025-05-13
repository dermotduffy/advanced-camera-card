import { sub } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { isMediaWithinDates } from '../../../src/ha/browse-media/within-dates';
import { createBrowseMedia, createRichBrowseMedia } from '../../test-utils';

describe('isMediaWithinDates', () => {
  const rangeStart = new Date('2024-11-19T07:00:00');
  const rangeEnd = new Date('2024-11-19T08:00:00');

  it('should never match media without metadata', () => {
    const media = createBrowseMedia();
    expect(isMediaWithinDates(media, rangeStart, rangeEnd)).toBe(false);
  });

  it('should always match media without start or end date', () => {
    expect(isMediaWithinDates(createRichBrowseMedia(), undefined, undefined)).toBe(true);
  });

  it('should match without a start date in the range', () => {
    expect(isMediaWithinDates(createRichBrowseMedia(), undefined, rangeEnd)).toBe(true);
  });

  it('should match without an end date in the range', () => {
    expect(isMediaWithinDates(createRichBrowseMedia(), rangeStart, undefined)).toBe(
      true,
    );
  });

  it('should match when ranges overlap', () => {
    expect(isMediaWithinDates(createRichBrowseMedia(), rangeStart, rangeEnd)).toBe(true);
  });

  it('should not match when ranges do not overlap', () => {
    expect(
      isMediaWithinDates(
        createRichBrowseMedia(),
        sub(rangeStart, { days: 1 }),
        sub(rangeEnd, { days: 1 }),
      ),
    ).toBe(false);
  });
});
