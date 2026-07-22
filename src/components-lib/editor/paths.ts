import type { ConfigPath } from './types';

/**
 * Convert the container path `ha-form` passes to `computeLabel`/`computeHelper`
 * into configuration order. `ha-form` builds the path by appending each
 * enclosing group's name as the call climbs outward, so the segments arrive
 * innermost-first (e.g. `['dashboard', 'cast']` for `cast.dashboard`).
 * @param options The options object passed by `ha-form`.
 * @returns The container path segments in configuration order.
 */
export const getFormContainerPath = (options?: { path?: string[] }): string[] =>
  [...(options?.path ?? [])].reverse();

/**
 * Strip array indices from a configuration path. Localization keys and
 * documentation links mirror configuration paths without them (e.g.
 * `config.cameras.title` covers every camera).
 * @param path The configuration path segments.
 * @returns The path segments without array indices.
 */
export const stripArrayIndices = (path: ConfigPath): string[] =>
  path.filter(
    (segment): segment is string =>
      typeof segment === 'string' && !/^\d+$/.test(segment),
  );
