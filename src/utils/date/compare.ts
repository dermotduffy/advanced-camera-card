export const getEarliestDate = (...dates: (Date | null | undefined)[]): Date | null => {
  let earliest: Date | null = null;
  for (const date of dates) {
    if (date && (!earliest || date < earliest)) {
      earliest = date;
    }
  }
  return earliest;
};
