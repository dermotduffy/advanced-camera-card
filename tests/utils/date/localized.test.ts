import { describe, expect, it } from 'vitest';

import {
  formatDateTime,
  formatMonth,
  formatShortDate,
  formatTime,
  formatTimeToParts,
  setDateTimeLocale,
} from '../../../src/utils/date/localized';
import { stubDateTimeLocale } from '../../test-utils';

// All in the browser's time zone, as the card shows them.
const now = new Date('2026-11-17T18:00:00');
const today = new Date('2026-11-17T15:05:09');
const morning = new Date('2026-11-17T09:05:09');
const yesterday = new Date('2026-11-16T15:05:09');
const lastYear = new Date('2025-11-16T15:05:09');

describe('formatTime', () => {
  describe('should show the time in the 12/24-hour format', () => {
    it('should show 24-hour time', () => {
      stubDateTimeLocale({ time_format: '24' });

      expect(formatTime(today)).toBe('15:05');
      expect(formatTime(morning)).toBe('09:05');
    });

    it('should show 12-hour time', () => {
      stubDateTimeLocale({ time_format: '12' });

      expect(formatTime(today)).toMatch(/^3:05\sPM$/);
      expect(formatTime(morning)).toMatch(/^9:05\sAM$/);
    });

    it('should show the format of the language', () => {
      stubDateTimeLocale({ language: 'en-US', time_format: 'language' });
      expect(formatTime(today)).toMatch(/^3:05\sPM$/);

      stubDateTimeLocale({ language: 'en-GB', time_format: 'language' });
      expect(formatTime(today)).toBe('15:05');
    });

    it('should show the format of a language with its own digits', () => {
      stubDateTimeLocale({ language: 'bn', time_format: 'language' });

      expect(formatTimeToParts(today)).toContainEqual(
        expect.objectContaining({ type: 'dayPeriod' }),
      );
    });

    it('should show the format of the system', () => {
      const systemAmPm = !!new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
      }).resolvedOptions().hour12;

      stubDateTimeLocale({ language: 'en-GB', time_format: 'system' });

      expect(formatTime(today)).toMatch(systemAmPm ? /^3:05\s(pm|PM)$/ : /^15:05$/);
    });
  });

  it('should show seconds', () => {
    stubDateTimeLocale({ time_format: '24' });

    expect(formatTime(today, { seconds: true })).toBe('15:05:09');
  });

  it('should show the time in the language', () => {
    stubDateTimeLocale({ language: 'ko', time_format: '12' });

    expect(formatTime(today)).toMatch(/^오후\s?3:05$/);
  });

  describe('should show the format of the browser', () => {
    it('should show it without Home Assistant', () => {
      setDateTimeLocale(null);

      expect(formatTime(today)).toBe(
        today.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
      );
    });

    it('should show it once the locale is removed', () => {
      stubDateTimeLocale({ language: 'en-GB', time_format: '24' });
      setDateTimeLocale(null);

      expect(formatTime(today)).toBe(
        today.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
      );
    });
  });

  describe('should follow changes to the settings', () => {
    it('should keep the same settings for an unchanged locale', () => {
      stubDateTimeLocale({ time_format: '24' });
      expect(formatTime(today)).toBe('15:05');

      stubDateTimeLocale({ time_format: '24' });
      expect(formatTime(today)).toBe('15:05');
      expect(formatTime(morning)).toBe('09:05');
    });

    it('should follow a new 12/24-hour setting', () => {
      stubDateTimeLocale({ language: 'en-US', time_format: '24' });
      expect(formatTime(today)).toBe('15:05');

      stubDateTimeLocale({ language: 'en-US', time_format: '12' });
      expect(formatTime(today)).toMatch(/^3:05\sPM$/);
    });

    it('should follow a new language', () => {
      stubDateTimeLocale({ language: 'en-US', time_format: '12' });
      expect(formatTime(today)).toMatch(/^3:05\sPM$/);

      stubDateTimeLocale({ language: 'ko', time_format: '12' });
      expect(formatTime(today)).toMatch(/^오후\s?3:05$/);
    });
  });
});

describe('formatTimeToParts', () => {
  it('should show the time', () => {
    stubDateTimeLocale({ language: 'en-US', time_format: '12' });

    expect(
      formatTimeToParts(today, { seconds: true })
        .map((part) => part.value)
        .join(''),
    ).toMatch(/^3:05:09\sPM$/);
  });

  it('should type the seconds', () => {
    stubDateTimeLocale({ time_format: '24' });

    expect(formatTimeToParts(today, { seconds: true })).toContainEqual({
      type: 'second',
      value: '09',
    });
  });

  it('should leave out the seconds unless asked', () => {
    stubDateTimeLocale({ time_format: '24' });

    expect(formatTimeToParts(today).map((part) => part.type)).not.toContain('second');
  });

  it('should type AM/PM', () => {
    stubDateTimeLocale({ language: 'en-US', time_format: '12' });

    expect(formatTimeToParts(today)).toContainEqual({ type: 'dayPeriod', value: 'PM' });
  });
});

describe('formatShortDate', () => {
  it('should leave out the year when it is that of now', () => {
    stubDateTimeLocale({ language: 'en-GB' });

    expect(formatShortDate(yesterday, now)).toBe('16 Nov');
  });

  it('should show the year when it is not that of now', () => {
    stubDateTimeLocale({ language: 'en-GB' });

    expect(formatShortDate(lastYear, now)).toBe('16 Nov 2025');
  });

  it('should show the date in the language', () => {
    stubDateTimeLocale({ language: 'nl' });

    expect(formatShortDate(yesterday, now)).toMatch(/^16 nov\.?$/);
  });
});

describe('formatDateTime', () => {
  it('should show the full date and time', () => {
    stubDateTimeLocale({ language: 'en-GB', time_format: '24' });

    expect(formatDateTime(today)).toMatch(/^17 Nov 2026,? 15:05$/);
  });

  it('should show seconds', () => {
    stubDateTimeLocale({ language: 'en-GB', time_format: '24' });

    expect(formatDateTime(today, { seconds: true })).toMatch(/^17 Nov 2026,? 15:05:09$/);
  });

  it('should show 12-hour time with the date', () => {
    stubDateTimeLocale({ language: 'en-US', time_format: '12' });

    expect(formatDateTime(today)).toMatch(/^Nov 17, 2026,? 3:05\sPM$/);
  });
});

describe('formatMonth', () => {
  it('should show the month and year in the language', () => {
    stubDateTimeLocale({ language: 'nl' });

    expect(formatMonth(new Date(2026, 10, 1))).toBe('november 2026');
  });
});
