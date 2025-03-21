import { deepRemoveDefaults } from '../../utils/zod.js';
import { getConfigValue, setConfigValue } from '../management.js';
import { ProfileType } from '../schema/profiles.js';
import { advancedCameraCardConfigSchema } from '../schema/types.js';
import { RawAdvancedCameraCardConfig } from '../types.js';
import { CASTING_PROFILE } from './casting.js';
import { LOW_PERFORMANCE_PROFILE } from './low-performance.js';
import { SCRUBBING_PROFILE } from './scrubbing.js';

const PROFILES = {
  casting: CASTING_PROFILE,
  'low-performance': LOW_PERFORMANCE_PROFILE,
  scrubbing: SCRUBBING_PROFILE,
};

/**
 * Set a profile. Sets flags as defined in the relevant profile unless they are
 * explicitly overriden in the configuration.
 * @param inputConfig The raw unparsed input configuration.
 * @param outputConfig The output config to write to.
 * @returns A changed (in-place) parsed input configuration.
 */
export const setProfiles = <T extends RawAdvancedCameraCardConfig>(
  inputConfig: RawAdvancedCameraCardConfig,
  outputConfig: T,
  profiles?: ProfileType[],
): T => {
  const defaultLessParseResult = deepRemoveDefaults(
    advancedCameraCardConfigSchema,
  ).safeParse(inputConfig);
  if (!defaultLessParseResult.success) {
    return outputConfig;
  }
  const defaultLessConfig = defaultLessParseResult.data;

  const setIfNotSpecified = (key: string, value: unknown) => {
    if (getConfigValue(defaultLessConfig, key) === undefined) {
      setConfigValue(outputConfig, key, value);
    }
  };

  for (const profile of profiles ?? []) {
    if (profile in PROFILES) {
      Object.entries(PROFILES[profile]).forEach(([k, v]: [string, unknown]) =>
        setIfNotSpecified(k, v),
      );
    }
  }

  return outputConfig;
};
