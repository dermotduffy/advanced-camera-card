export const isValidDate = (date: Date): boolean => {
  return !isNaN(date.getTime());
};

/**
 * Determine whether a 'YYYY-MM-DD' string names a day that exists.
 */
export const isValidDay = (day: string): boolean => {
  const date = new Date(`${day}T00:00:00Z`);

  // Javascript quirk: A day past the end of its month (e.g. '2023-02-31') rolls
  // over into the next month instead of being rejected, so check the day
  // survives a round trip rather than only that it parsed.
  return isValidDate(date) && date.toISOString().startsWith(day);
};
