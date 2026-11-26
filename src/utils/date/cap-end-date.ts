export const capEndDate = (end: Date): Date => {
  const now = new Date();
  return end > now ? now : end;
};
