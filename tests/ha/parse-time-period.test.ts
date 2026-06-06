import { describe, expect, it } from 'vitest';
import { parseTimePeriodToSeconds } from '../../src/ha/parse-time-period';

describe('parseTimePeriodToSeconds', () => {
  it('should accept a number of seconds', () => {
    expect(parseTimePeriodToSeconds(5)).toBe(5);
    expect(parseTimePeriodToSeconds(0)).toBe(0);
  });

  it('should reject a negative number', () => {
    expect(parseTimePeriodToSeconds(-1)).toBeNull();
  });

  it('should parse a bare numeric string as seconds', () => {
    expect(parseTimePeriodToSeconds('5')).toBe(5);
  });

  it('should read HH:MM and HH:MM:SS (two parts are hours:minutes, as in HA)', () => {
    expect(parseTimePeriodToSeconds('01:30')).toBe(5400);
    expect(parseTimePeriodToSeconds('00:05')).toBe(300);
    expect(parseTimePeriodToSeconds('00:00:05')).toBe(5);
    expect(parseTimePeriodToSeconds('1:00:00')).toBe(3600);
  });

  it('should reject unparseable, empty-part, or over-long strings', () => {
    expect(parseTimePeriodToSeconds('not-a-duration')).toBeNull();
    expect(parseTimePeriodToSeconds('1:ab')).toBeNull();
    expect(parseTimePeriodToSeconds('1:2:3:4')).toBeNull();
    expect(parseTimePeriodToSeconds('5:')).toBeNull();
    expect(parseTimePeriodToSeconds('')).toBeNull();
  });

  it('should accept a {days, hours, minutes, seconds, milliseconds} dict', () => {
    expect(parseTimePeriodToSeconds({ seconds: 5 })).toBe(5);
    expect(parseTimePeriodToSeconds({ hours: 1, minutes: 30 })).toBe(5400);
    expect(parseTimePeriodToSeconds({ days: 1 })).toBe(86400);
    expect(parseTimePeriodToSeconds({ milliseconds: 500 })).toBe(0.5);
    expect(parseTimePeriodToSeconds({})).toBe(0);
  });

  it('should reject a negative dict period', () => {
    expect(parseTimePeriodToSeconds({ seconds: -5 })).toBeNull();
  });
});
