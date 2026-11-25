import type { FrontendLocaleData } from '../../ha/types';

interface DateTimeLocaleState {
  locale: FrontendLocaleData | null;

  // `null` without a locale, so that the browser's own format is used.
  usesAMPM: boolean | null;

  formatters: Map<string, Intl.DateTimeFormat>;
}

// Kept per module (e.g. to language in `localize()`) rather than passed to
// every caller: the locale belongs to the user, not to a card, and usage (e.g.
// media titles) are far from any `hass`.
let state: DateTimeLocaleState = { locale: null, usesAMPM: null, formatters: new Map() };

// Whether times show with AM/PM. The `language` and `system` settings follow
// the convention of the user's language or of the browser's.
const usesAMPM = (locale: FrontendLocaleData): boolean => {
  if (locale.time_format === 'language' || locale.time_format === 'system') {
    return !!new Intl.DateTimeFormat(
      locale.time_format === 'language' ? locale.language : undefined,
      { hour: 'numeric' },
    ).resolvedOptions().hour12;
  }
  return locale.time_format === '12';
};

/**
 * Show dates and times as Home Assistant's frontend does for this user: in
 * their language and 12/24-hour setting (in the browser's time zone, as the
 * rest of the card is). Home Assistant replaces its locale object whenever a
 * setting changes, so a call with the current object does nothing.
 */
export const setDateTimeLocale = (locale: FrontendLocaleData | null): void => {
  if (locale === state.locale) {
    return;
  }
  state = {
    locale,
    usesAMPM: locale ? usesAMPM(locale) : null,
    formatters: new Map(),
  };
};

// Constructing a formatter costs far more than using one, and thumbnails format
// many dates at once.
const getFormatter = (options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat => {
  const key = JSON.stringify(options);

  const cached = state.formatters.get(key);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat(state.locale?.language, options);
  state.formatters.set(key, formatter);

  return formatter;
};

const getTimeOptions = (seconds?: boolean): Intl.DateTimeFormatOptions => ({
  hour: state.usesAMPM === false ? '2-digit' : 'numeric',
  minute: '2-digit',
  ...(seconds && { second: '2-digit' }),
  ...(state.usesAMPM !== null && { hourCycle: state.usesAMPM ? 'h12' : 'h23' }),
});

/**
 * A time, such as `4:55 PM` or `16:55` depending on the user's 12/24-hour
 * setting. `seconds` adds the seconds, such as `4:55:47 PM`.
 */
export const formatTime = (date: Date, options?: { seconds?: boolean }): string =>
  getFormatter(getTimeOptions(options?.seconds)).format(date);

/**
 * The same time as `formatTime()`, as typed pieces (such as `hour`, `second` or
 * `dayPeriod` for AM/PM) so that each can be styled on its own.
 */
export const formatTimeToParts = (
  date: Date,
  options?: { seconds?: boolean },
): Intl.DateTimeFormatPart[] =>
  getFormatter(getTimeOptions(options?.seconds)).formatToParts(date);

/**
 * A short date, such as `Nov 23`. The year is added, such as `Nov 23, 2025`,
 * only when the date falls in a different year from `now`.
 */
export const formatShortDate = (date: Date, now: Date): string =>
  getFormatter({
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
  }).format(date);

/**
 * The full date and time, such as `Nov 23, 2026, 4:55 PM`, always with the
 * year. `seconds` adds the seconds. Suits text read on its own, such as a media
 * title or a tooltip.
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
