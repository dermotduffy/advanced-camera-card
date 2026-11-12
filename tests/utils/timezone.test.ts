import { describe, expect, it } from 'vitest';

import {
  createDayHourResolver,
  endOfHourInTimeZone,
  getDayHourInTimeZone,
  hourInTimeZoneToDate,
  startOfHourInTimeZone,
} from '../../src/utils/timezone';

describe('startOfHourInTimeZone', () => {
  it('should get the start of the hour', () => {
    expect(
      startOfHourInTimeZone(new Date('2023-04-29T18:43:21.123Z'), 'America/New_York'),
    ).toEqual(new Date('2023-04-29T18:00:00.000Z'));
  });

  it('should get the start of the hour in a half-hour offset timezone', () => {
    expect(
      startOfHourInTimeZone(new Date('2023-04-29T18:43:21.123Z'), 'Asia/Kolkata'),
    ).toEqual(new Date('2023-04-29T18:30:00.000Z'));
  });
});

describe('endOfHourInTimeZone', () => {
  it('should get the end of the hour', () => {
    expect(
      endOfHourInTimeZone(new Date('2023-04-29T18:43:21.123Z'), 'America/New_York'),
    ).toEqual(new Date('2023-04-29T18:59:59.999Z'));
  });

  it('should get the end of the hour in a half-hour offset timezone', () => {
    expect(
      endOfHourInTimeZone(new Date('2023-04-29T18:43:21.123Z'), 'Asia/Kolkata'),
    ).toEqual(new Date('2023-04-29T19:29:59.999Z'));
  });
});

describe('hourInTimeZoneToDate', () => {
  it('should convert a day and hour to a date', () => {
    expect(hourInTimeZoneToDate('2023-04-29', 14, 'America/New_York')).toEqual(
      new Date('2023-04-29T18:00:00.000Z'),
    );
  });

  it('should convert a day and hour in a different timezone to a different date', () => {
    expect(hourInTimeZoneToDate('2023-04-29', 14, 'America/Chicago')).toEqual(
      new Date('2023-04-29T19:00:00.000Z'),
    );
  });

  it('should convert a midnight hour to a date', () => {
    expect(hourInTimeZoneToDate('2023-04-29', 0, 'America/New_York')).toEqual(
      new Date('2023-04-29T04:00:00.000Z'),
    );
  });
});

describe('getDayHourInTimeZone', () => {
  it('should get the day and hour', () => {
    expect(
      getDayHourInTimeZone(new Date('2023-04-29T18:43:21.123Z'), 'America/New_York'),
    ).toEqual({ day: '2023-04-29', hour: 14 });
  });

  it('should get the day and hour in a half-hour offset timezone', () => {
    expect(
      getDayHourInTimeZone(new Date('2026-03-14T14:30:00.000Z'), 'Asia/Kolkata'),
    ).toEqual({ day: '2026-03-14', hour: 20 });
  });

  it('should report midnight as hour zero', () => {
    expect(getDayHourInTimeZone(new Date('2023-04-29T00:00:00.000Z'), 'UTC')).toEqual({
      day: '2023-04-29',
      hour: 0,
    });
  });

  it('should get a day that has already advanced in the given timezone', () => {
    expect(
      getDayHourInTimeZone(new Date('2026-03-14T20:00:00.000Z'), 'Pacific/Auckland'),
    ).toEqual({ day: '2026-03-15', hour: 9 });
  });
});

describe('daylight savings transitions', () => {
  it('should find the start of an hour that does not exist in the browser timezone', () => {
    // A browser in America/New_York has no 02:30 on this date.
    expect(startOfHourInTimeZone(new Date('2024-03-10T02:30:00.000Z'), 'UTC')).toEqual(
      new Date('2024-03-10T02:00:00.000Z'),
    );
  });

  it('should keep an hour one hour long across a browser timezone gap', () => {
    expect(endOfHourInTimeZone(new Date('2024-03-10T02:30:00.000Z'), 'UTC')).toEqual(
      new Date('2024-03-10T02:59:59.999Z'),
    );
  });
});

describe('createDayHourResolver', () => {
  it('should resolve multiple dates against one timezone', () => {
    const resolve = createDayHourResolver('America/Chicago');

    expect(resolve(new Date('2026-08-30T19:19:00Z'))).toEqual({
      day: '2026-08-30',
      hour: 14,
    });
    expect(resolve(new Date('2026-08-31T05:00:00Z'))).toEqual({
      day: '2026-08-31',
      hour: 0,
    });
  });
});
