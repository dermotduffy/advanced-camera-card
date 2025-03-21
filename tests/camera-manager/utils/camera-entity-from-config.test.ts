import { describe, expect, it } from 'vitest';
import { getCameraEntityFromConfig } from '../../../src/camera-manager/utils/camera-entity-from-config.js';
import { CameraConfig, cameraConfigSchema } from '../../../src/config/schema/cameras.js';

describe('getCameraEntityFromConfig', () => {
  const createCameraConfig = (config: Partial<CameraConfig>): CameraConfig => {
    return cameraConfigSchema.parse(config);
  };

  it('should get camera_entity', () => {
    expect(getCameraEntityFromConfig(createCameraConfig({ camera_entity: 'foo' }))).toBe(
      'foo',
    );
  });
  it('should get camera_entity from webrtc_card config', () => {
    expect(
      getCameraEntityFromConfig(createCameraConfig({ webrtc_card: { entity: 'bar' } })),
    ).toBe('bar');
  });
  it('should get no camera_entity', () => {
    expect(getCameraEntityFromConfig(createCameraConfig({}))).toBeNull();
  });
});
