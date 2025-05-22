// Usage of this function needs to be justified with a comment.
export const sleep = async (seconds: number) => {
  await new Promise((r) => setTimeout(r, seconds * 1000));
};
