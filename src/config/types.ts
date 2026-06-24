import type { PartialDeep } from 'type-fest';

import type { AdvancedCameraCardConfig } from './schema/types';

export type RawAdvancedCameraCardConfig = Record<string, unknown>;
export type RawAdvancedCameraCardConfigArray = RawAdvancedCameraCardConfig[];

// A partial config used for pre-parsed configs (e.g. a stub config). Nested
// fields are optional because their defaults are applied when the config is
// parsed.
export type PartialAdvancedCameraCardConfig = PartialDeep<
  AdvancedCameraCardConfig,
  { recurseIntoArrays: true }
>;
