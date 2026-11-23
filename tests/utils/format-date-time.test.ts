import { afterEach, describe, expect, it } from 'vitest';

import type { HomeAssistant } from '../../src/ha/types';
import {
  formatDateTime,
  formatMonth,
  formatShortDate,
  formatTime,
  formatTimeParts,
  setDateTimeLocale,
} from '../../src/utils/format-date-time';
import { createLocaleHASS } from '../test-utils';

// All in the browser's time zone, as the card shows them.
const now = new Date('2026-11-17T18:00:00');
const today = new Date('2026-11-17T15:05:09');
const morning = new Date('2026-11-17T09:05:09');
const yesterday = new Date('2026-11-16T15:05:09');
const lastYear = new Date('2025-11-16T15:05:09');

// The browser's own 24-hour time, for a language Home Assistant gives that the
// browser cannot use.
const browser24Hour = (date: Date): string =>
  new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);

afterEach(() => {
  setDateTimeLocale(null);
});

describe('formatTime', () => {
  describe('should show the time in the 12/24-hour format', () => {
    it('should show 24-hour time', () => {
      setDateTimeLocale(createLocaleHASS({ time_format: '24' }));

      expect(formatTime(today)).toBe('15:05');
      expect(formatTime(morning)).toBe('09:05');
    });

    it('should show 12-hour time', () => {
      setDateTimeLocale(createLocaleHASS({ time_format: '12' }));

      expect(formatTime(today)).toMatch(/^3:05\sPM$/);
      expect(formatTime(morning)).toMatch(/^9:05\sAM$/);
    });

    it('should show the format of the language', () => {
      setDateTimeLocale(
        createLocaleHASS({ language: 'en-US', time_format: 'language' }),
      );
      expect(formatTime(today)).toMatch(/^3:05\sPM$/);

      setDateTimeLocale(
        createLocaleHASS({ language: 'en-GB', time_format: 'language' }),
      );
      expect(formatTime(today)).toBe('15:05');
    });

    it('should show the format of the system', () => {
      const systemAmPm = new Date('January 1, 2023 22:00:00')
        .toLocaleString()
        .includes('10');

      setDateTimeLocale(createLocaleHASS({ language: 'en-GB', time_format: 'system' }));

      expect(formatTime(today)).toMatch(systemAmPm ? /^3:05\s(pm|PM)$/ : /^15:05$/);
    });

    it('should show 24-hour time for any other setting, as Home Assistant does', () => {
      setDateTimeLocale(createLocaleHASS({ language: 'en-US', time_format: 'other' }));

      expect(formatTime(today)).toBe('15:05');
    });
  });

  it('should show seconds', () => {
    setDateTimeLocale(createLocaleHASS({ time_format: '24' }));

    expect(formatTime(today, { seconds: true })).toBe('15:05:09');
  });

  it('should show the time in the language', () => {
    setDateTimeLocale(createLocaleHASS({ language: 'ko', time_format: '12' }));

    expect(formatTime(today)).toMatch(/^오후\s?3:05$/);
  });

  describe('should show the format of the browser', () => {
    it('should show it without Home Assistant', () => {
      setDateTimeLocale(null);

      expect(formatTime(today)).toBe(
        today.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
      );
    });

    it('should show it for a Home Assistant without a locale', () => {
      setDateTimeLocale(createLocaleHASS({ language: 'en-GB', time_format: '24' }));
      setDateTimeLocale({} as HomeAssistant);

      expect(formatTime(today)).toBe(
        today.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
      );
    });

    it.each([['en_US'], ['']])(
      "should use the browser's language for the invalid language %j",
      (language) => {
        setDateTimeLocale(createLocaleHASS({ language, time_format: '24' }));

        expect(formatTime(today)).toBe(browser24Hour(today));
      },
    );

    it("should use the browser's language for a language that is not a string", () => {
      setDateTimeLocale({
        locale: { language: 42, time_format: '24' },
      } as unknown as HomeAssistant);

      expect(formatTime(today)).toBe(browser24Hour(today));
    });
  });

  describe('should follow changes to the settings', () => {
    it('should keep the same settings for an unchanged Home Assistant', () => {
      setDateTimeLocale(createLocaleHASS({ time_format: '24' }));
      expect(formatTime(today)).toBe('15:05');

      setDateTimeLocale(createLocaleHASS({ time_format: '24' }));
      expect(formatTime(today)).toBe('15:05');
      expect(formatTime(morning)).toBe('09:05');
    });

    it('should follow a new 12/24-hour setting', () => {
      setDateTimeLocale(createLocaleHASS({ language: 'en-US', time_format: '24' }));
      expect(formatTime(today)).toBe('15:05');

      setDateTimeLocale(createLocaleHASS({ language: 'en-US', time_format: '12' }));
      expect(formatTime(today)).toMatch(/^3:05\sPM$/);
    });

    it('should follow a new language', () => {
      setDateTimeLocale(createLocaleHASS({ language: 'en-US', time_format: '12' }));
      expect(formatTime(today)).toMatch(/^3:05\sPM$/);

      setDateTimeLocale(createLocaleHASS({ language: 'ko', time_format: '12' }));
      expect(formatTime(today)).toMatch(/^오후\s?3:05$/);
    });
  });
});

describe('formatTimeParts', () => {
  it('should split a 24-hour time before its seconds', () => {
    setDateTimeLocale(createLocaleHASS({ time_format: '24' }));

    expect(formatTimeParts(today)).toEqual({ hoursMinutes: '15:05', seconds: ':09' });
  });

  it('should keep AM/PM with the seconds where it follows them', () => {
    setDateTimeLocale(createLocaleHASS({ language: 'en-US', time_format: '12' }));

    const parts = formatTimeParts(today);
    expect(parts.hoursMinutes).toBe('3:05');
    expect(parts.seconds).toMatch(/^:09\sPM$/);
  });

  it.each([
    ['ko', /^오후\s?3:05$/],
    ['ja', /^午後\s?3:05$/],
  ])(
    'should keep AM/PM with the hours where it comes first (%s)',
    (language, hoursMinutes) => {
      setDateTimeLocale(createLocaleHASS({ language, time_format: '12' }));

      const parts = formatTimeParts(today);
      expect(parts.hoursMinutes).toMatch(hoursMinutes);
      expect(parts.seconds).toBe(':09');
    },
  );
});

describe('formatShortDate', () => {
  it('should leave out the year when it is that of now', () => {
    setDateTimeLocale(createLocaleHASS({ language: 'en-GB' }));

    expect(formatShortDate(yesterday, now)).toBe('16 Nov');
  });

  it('should show the year when it is not that of now', () => {
    setDateTimeLocale(createLocaleHASS({ language: 'en-GB' }));

    expect(formatShortDate(lastYear, now)).toBe('16 Nov 2025');
  });

  it('should show the date in the language', () => {
    setDateTimeLocale(createLocaleHASS({ language: 'nl' }));

    expect(formatShortDate(yesterday, now)).toMatch(/^16 nov\.?$/);
  });
});

describe('formatDateTime', () => {
  it('should show the full date and time', () => {
    setDateTimeLocale(createLocaleHASS({ language: 'en-GB', time_format: '24' }));

    expect(formatDateTime(today)).toMatch(/^17 Nov 2026,? 15:05$/);
  });

  it('should show seconds', () => {
    setDateTimeLocale(createLocaleHASS({ language: 'en-GB', time_format: '24' }));

    expect(formatDateTime(today, { seconds: true })).toMatch(/^17 Nov 2026,? 15:05:09$/);
  });

  it('should show 12-hour time with the date', () => {
    setDateTimeLocale(createLocaleHASS({ language: 'en-US', time_format: '12' }));

    expect(formatDateTime(today)).toMatch(/^Nov 17, 2026,? 3:05\sPM$/);
  });
});

describe('formatMonth', () => {
  it('should show the month and year in the language', () => {
    setDateTimeLocale(createLocaleHASS({ language: 'nl' }));

    expect(formatMonth(new Date(2026, 10, 1))).toBe('november 2026');
  });
});
