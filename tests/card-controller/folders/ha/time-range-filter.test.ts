import { describe, expect, it } from 'vitest';

import { filterFoldersByTimeRange } from '../../../../src/card-controller/folders/ha/time-range-filter';

describe('filterFoldersByTimeRange', () => {
  const days = ['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'];

  // Folders are named for their date, optionally followed by a suffix.
  const filter = (
    folders: string[],
    timeRange: { start?: string; end?: string },
  ): string[] =>
    filterFoldersByTimeRange(
      folders,
      {
        ...(timeRange.start && { start: new Date(timeRange.start) }),
        ...(timeRange.end && { end: new Date(timeRange.end) }),
      },
      (folder) =>
        folder.startsWith('2026') ? new Date(`${folder.slice(0, 10)}T00:00:00`) : null,
    );

  it.each([
    ['no range', {}, days],
    [
      'a range within a folder',
      { start: '2026-11-10T10:00:00', end: '2026-11-10T11:00:00' },
      ['2026-11-09', '2026-11-10'],
    ],
    [
      'a range across folders',
      { start: '2026-11-10T23:00:00', end: '2026-11-11T01:00:00' },
      ['2026-11-09', '2026-11-10', '2026-11-11'],
    ],
    [
      'a range that starts as a folder starts',
      { start: '2026-11-10T00:00:00', end: '2026-11-10T01:00:00' },
      ['2026-11-09', '2026-11-10'],
    ],
    [
      'a range that starts just before a folder starts',
      { start: '2026-11-09T23:59:59.999', end: '2026-11-10T01:00:00' },
      ['2026-11-08', '2026-11-09', '2026-11-10'],
    ],
    [
      'a range that ends as a folder starts',
      { start: '2026-11-10T10:00:00', end: '2026-11-11T00:00:00' },
      ['2026-11-09', '2026-11-10', '2026-11-11'],
    ],
    [
      'a range that ends just before a folder starts',
      { start: '2026-11-10T10:00:00', end: '2026-11-10T23:59:59.999' },
      ['2026-11-09', '2026-11-10'],
    ],
    [
      'a range within the earliest folder',
      { start: '2026-11-08T10:00:00', end: '2026-11-08T11:00:00' },
      ['2026-11-08'],
    ],
    [
      'a range that starts before every folder',
      { start: '2026-11-01T00:00:00', end: '2026-11-08T01:00:00' },
      ['2026-11-08'],
    ],
    [
      'a range entirely before every folder',
      { start: '2026-11-01T00:00:00', end: '2026-11-02T00:00:00' },
      [],
    ],
    [
      'a range after every folder has started',
      { start: '2026-11-20T00:00:00', end: '2026-11-21T00:00:00' },
      ['2026-11-12'],
    ],
    [
      'a range without an end',
      { start: '2026-11-11T10:00:00' },
      ['2026-11-10', '2026-11-11', '2026-11-12'],
    ],
    [
      'a range without a start',
      { end: '2026-11-09T10:00:00' },
      ['2026-11-08', '2026-11-09'],
    ],
  ])(
    'should include the folders that may contain media for %s',
    (_name, timeRange, expected) => {
      expect(filter(days, timeRange)).toEqual(expected);
    },
  );

  it('should treat a folder as covering the days until the next folder, even across missing days', () => {
    expect(
      filter(['2026-11-01', '2026-11-03', '2026-11-12'], {
        start: '2026-11-08T00:00:00',
        end: '2026-11-09T00:00:00',
      }),
    ).toEqual(['2026-11-03']);
  });

  it('should include an earlier folder only if its media may have started within 24 hours before the time range', () => {
    const folders = ['2026-11-08', '2026-11-09'];

    // Media from 2026-11-08 starts before 2026-11-09, so may run until
    // 2026-11-10 00:00 at the latest.
    expect(
      filter(folders, { start: '2026-11-09T23:00:00', end: '2026-11-10T01:00:00' }),
    ).toEqual(['2026-11-08', '2026-11-09']);
    expect(
      filter(folders, { start: '2026-11-10T00:00:00', end: '2026-11-10T01:00:00' }),
    ).toEqual(['2026-11-09']);
  });

  it('should include every folder that shares an included date', () => {
    expect(
      filter(
        [
          '2026-11-08',
          '2026-11-09 front',
          '2026-11-09 back',
          '2026-11-10 front',
          '2026-11-10 back',
          '2026-11-11',
        ],
        { start: '2026-11-10T10:00:00', end: '2026-11-10T11:00:00' },
      ),
    ).toEqual([
      '2026-11-09 front',
      '2026-11-09 back',
      '2026-11-10 front',
      '2026-11-10 back',
    ]);
  });

  it('should include folders without a date', () => {
    expect(
      filter(['Favorites', ...days, 'Other'], {
        start: '2026-11-10T10:00:00',
        end: '2026-11-10T11:00:00',
      }),
    ).toEqual(['Favorites', '2026-11-09', '2026-11-10', 'Other']);
  });

  it('should preserve the order of folders', () => {
    expect(
      filter([...days].reverse(), {
        start: '2026-11-10T10:00:00',
        end: '2026-11-11T11:00:00',
      }),
    ).toEqual(['2026-11-11', '2026-11-10', '2026-11-09']);
  });
});
