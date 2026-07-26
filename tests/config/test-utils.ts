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

export const createCameraConfig = (config?: unknown): CameraConfig => {
  return cameraConfigSchema.parse(config ?? {});
};
