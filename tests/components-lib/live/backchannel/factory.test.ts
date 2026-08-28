import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { Camera } from '../../../../src/camera-manager/camera';
import type { CameraManagerEngine } from '../../../../src/camera-manager/engine';
import { FrigateCamera } from '../../../../src/camera-manager/frigate/camera';
import type {
  FrigateEventWatcher,
  FrigateReviewWatcher,
} from '../../../../src/camera-manager/frigate/watcher';
import { createBackchannel } from '../../../../src/components-lib/live/backchannel/factory';
import { Go2RTCBackchannel } from '../../../../src/components-lib/live/backchannel/go2rtc';
import type { EntityRegistryManager } from '../../../../src/ha/registry/entity/types';
import type { HomeAssistant } from '../../../../src/ha/types';
import { createCameraConfig } from '../../../config/test-utils';
import { createHASSManager } from '../../../test-utils';

describe('createBackchannel', () => {
  it('should create a backchannel for a go2rtc camera', () => {
    const camera = new Camera(
      createCameraConfig({
        live_provider: 'go2rtc',
        go2rtc: { url: 'https://go2rtc', stream: 'office' },
      }),
      mock<CameraManagerEngine>(),
      { hassManager: createHASSManager() },
    );

    expect(createBackchannel(mock<HomeAssistant>(), camera)).toBeInstanceOf(
      Go2RTCBackchannel,
    );
  });

  it('should create a backchannel for a go2rtc-experimental camera', () => {
    const camera = new Camera(
      createCameraConfig({
        live_provider: 'go2rtc-experimental',
        go2rtc: { url: 'https://go2rtc', stream: 'office' },
      }),
      mock<CameraManagerEngine>(),
      { hassManager: createHASSManager() },
    );

    expect(createBackchannel(mock<HomeAssistant>(), camera)).toBeInstanceOf(
      Go2RTCBackchannel,
    );
  });

  it('should not create a backchannel for a non-go2rtc camera', () => {
    const camera = new Camera(
      createCameraConfig({
        camera_entity: 'camera.office',
        live_provider: 'ha',
      }),
      mock<CameraManagerEngine>(),
      { hassManager: createHASSManager() },
    );

    expect(createBackchannel(mock<HomeAssistant>(), camera)).toBeNull();
  });

  it('should not create a backchannel without a go2rtc endpoint', () => {
    const camera = new Camera(
      createCameraConfig({ live_provider: 'go2rtc' }),
      mock<CameraManagerEngine>(),
      { hassManager: createHASSManager() },
    );

    expect(createBackchannel(mock<HomeAssistant>(), camera)).toBeNull();
  });

  it('should use the endpoint the camera engine resolves', () => {
    // A Frigate camera serves go2rtc through the Frigate integration's proxy
    // rather than at a directly-configured URL, so the endpoint must come from
    // the camera rather than being rebuilt from its configuration.
    const camera = new FrigateCamera(
      createCameraConfig({
        live_provider: 'go2rtc',
        frigate: { client_id: 'frigate', camera_name: 'office' },
      }),
      mock<CameraManagerEngine>(),
      {
        hassManager: createHASSManager(),
        entityRegistryManager: mock<EntityRegistryManager>(),
        frigateEventWatcher: mock<FrigateEventWatcher>(),
        frigateReviewWatcher: mock<FrigateReviewWatcher>(),
      },
    );

    expect(camera.getEndpoints()?.go2rtc?.endpoint).toBe(
      '/api/frigate/frigate/mse/api/ws?src=office',
    );
    expect(createBackchannel(mock<HomeAssistant>(), camera)).toBeInstanceOf(
      Go2RTCBackchannel,
    );
  });
});
