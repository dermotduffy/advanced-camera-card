// Usage of this function needs to be justified with a comment.
export const sleep = async (seconds: number) => {
  // This is the low-level delay primitive callers reach for instead of a raw timer.
  // eslint-disable-next-line no-restricted-syntax
  await new Promise((r) => setTimeout(r, seconds * 1000));
};
