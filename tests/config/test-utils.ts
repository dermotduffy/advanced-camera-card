import { cameraConfigSchema, type CameraConfig } from '../../src/config/schema/cameras';
import {
  performanceConfigSchema,
  type PerformanceConfig,
} from '../../src/config/schema/performance';
import {
  advancedCameraCardConfigSchema,
  type AdvancedCameraCardConfig,
} from '../../src/config/schema/types';
import type { RawAdvancedCameraCardConfig } from '../../src/config/types';

export const createRawConfig = (
  config?: Partial<RawAdvancedCameraCardConfig>,
): RawAdvancedCameraCardConfig => {
  return {
    type: 'advanced-camera-card',
    cameras: [{}],
    ...config,
  };
};

export const createConfig = (
  config?: RawAdvancedCameraCardConfig,
): AdvancedCameraCardConfig => {
  return advancedCameraCardConfigSchema.parse(createRawConfig(config));
};

export const createPerformanceConfig = (config: unknown): PerformanceConfig => {
  return performanceConfigSchema.parse(config);
};

// Deep freeze camera configurations under test to ensure any attempts to write
// to them result in a failure (e.g. writing to shared zod defaults).
export const createCameraConfig = (config?: unknown): CameraConfig => {
  return deepFreeze(cameraConfigSchema.parse(config ?? {}));
};

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
};
