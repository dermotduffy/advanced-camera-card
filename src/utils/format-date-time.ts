import type { HomeAssistant } from '../ha/types';

interface DateTimeLocale {
  language?: string;

  // `null` without Home Assistant, so that the browser's own format is used.
  amPm: boolean | null;
}

// Whether times show with AM/PM, decided as Home Assistant's frontend does
// (its `useAmPm()`).
const isAmPm = (language: string | undefined, timeFormat: unknown): boolean => {
  if (timeFormat === 'language' || timeFormat === 'system') {
    const test = new Date('January 1, 2023 22:00:00').toLocaleString(
      timeFormat === 'language' ? language : undefined,
    );
    return test.includes('10');
  }
  return timeFormat === '12';
};

// A language tag the browser cannot read (such as `en_US`) would make every
// format call throw, so it falls back to the browser's own language.
const getValidLanguage = (language: unknown): string | undefined => {
  if (typeof language !== 'string') {
    return undefined;
  }
  try {
    Intl.DateTimeFormat.supportedLocalesOf(language);
    return language;
  } catch {
    return undefined;
  }
};

// Kept per module (as the language in `localize()` is) rather than passed to
// every caller: the locale belongs to the user, not to a card, and the media
// titles that need it are made far from any `hass`.
let locale: DateTimeLocale = { amPm: null };
let formatters = new Map<string, Intl.DateTimeFormat>();

// What `locale` was made from.
let hadLocale = false;
let lastLanguage: unknown = undefined;
let lastTimeFormat: unknown = undefined;

/**
 * Show dates and times as Home Assistant's frontend does for this user: in
 * their language and 12/24-hour setting (in the browser's time zone, as the
 * rest of the card is). Called with every `hass`, so does nothing unless one
 * of those settings changed.
 */
export const setDateTimeLocale = (hass?: HomeAssistant | null): void => {
  const hassLocale = hass?.locale;
  const language: unknown = hassLocale?.language;
  const timeFormat: unknown = hassLocale?.time_format;
  if (
    !!hassLocale === hadLocale &&
    language === lastLanguage &&
    timeFormat === lastTimeFormat
  ) {
    return;
  }

  hadLocale = !!hassLocale;
  lastLanguage = language;
  lastTimeFormat = timeFormat;

  const validLanguage = getValidLanguage(language);
  locale = {
    language: validLanguage,
    amPm: hassLocale ? isAmPm(validLanguage, timeFormat) : null,
  };
  formatters = new Map();
};

// Constructing a formatter costs far more than using one, and thumbnails format
// many dates at once.
const getFormatter = (options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat => {
  const key = JSON.stringify(options);
  const cached = formatters.get(key);
  if (cached) {
    return cached;
  }
  const formatter = new Intl.DateTimeFormat(locale.language, options);
  formatters.set(key, formatter);
  return formatter;
};

const getTimeOptions = (seconds?: boolean): Intl.DateTimeFormatOptions => ({
  hour: locale.amPm === false ? '2-digit' : 'numeric',
  minute: '2-digit',
  ...(seconds && { second: '2-digit' }),
  ...(locale.amPm !== null && { hourCycle: locale.amPm ? 'h12' : 'h23' }),
});

export const formatTime = (date: Date, options?: { seconds?: boolean }): string =>
  getFormatter(getTimeOptions(options?.seconds)).format(date);

/**
 * A time with seconds, split so the seconds (and anything after them, such as
 * AM/PM) can be shown smaller.
 */
export const formatTimeParts = (
  date: Date,
): { hoursMinutes: string; seconds: string } => {
  const parts = getFormatter(getTimeOptions(true)).formatToParts(date);

  // From the separator before the seconds.
  const split = parts.findIndex((part) => part.type === 'second') - 1;
  const join = (from: number, to?: number): string =>
    parts
      .slice(from, to)
      .map((part) => part.value)
      .join('');

  return { hoursMinutes: join(0, split), seconds: join(split) };
};

/**
 * The day and month, and the year unless it is that of `now`.
 */
export const formatShortDate = (date: Date, now: Date): string =>
  getFormatter({
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
  }).format(date);

/**
 * The full date and time, for text read without the moment it was made in mind
 * (a title, a tooltip).
 */
export const formatDateTime = (date: Date, options?: { seconds?: boolean }): string =>
  getFormatter({
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...getTimeOptions(options?.seconds),
  }).format(date);

/**
 * A calendar month, such as `November 2026`.
 */
export const formatMonth = (date: Date): string =>
  getFormatter({ month: 'long', year: 'numeric' }).format(date);
