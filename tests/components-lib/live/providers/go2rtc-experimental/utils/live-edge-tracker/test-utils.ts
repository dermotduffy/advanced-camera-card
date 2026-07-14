export const createStatus = (
  bufferedEndSeconds: number,
  currentTimeSeconds: number,
  options?: { playbackRate?: number; now?: Date },
) => ({
  bufferedEndSeconds,
  currentTimeSeconds,
  playbackRate: options?.playbackRate ?? 1,
  now: options?.now ?? new Date(0),
});
