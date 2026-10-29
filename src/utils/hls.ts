// The hls.js player class. The card does not bundle hls.js: Home Assistant
// passes its own copy to the player, so only the constructor is described.
export type HlsConstructor = new (config?: Record<string, unknown>) => object;

/**
 * An hls.js class whose players start loading at `startPosition` (seconds from
 * the start of the stream), or the class itself when there is no position.
 */
export const withHLSStartPosition = (
  Hls: HlsConstructor,
  startPosition: number | null,
): HlsConstructor => {
  if (startPosition === null) {
    return Hls;
  }

  // A subclass, rather than a wrapper function, so the static members (e.g.
  // `Hls.Events`) the player reads from the class it is given are inherited.
  return class extends Hls {
    constructor(config?: Record<string, unknown>) {
      super({ ...config, startPosition: startPosition });
    }
  };
};
