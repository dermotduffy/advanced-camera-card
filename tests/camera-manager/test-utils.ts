import { vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { Camera } from '../../src/camera-manager/camera';
import { Capabilities } from '../../src/camera-manager/capabilities';
import type { CameraManagerEngine } from '../../src/camera-manager/engine';
import { GenericCameraManagerEngine } from '../../src/camera-manager/generic/engine-generic';
import type { CameraManager } from '../../src/camera-manager/manager';
import { CameraManagerStore } from '../../src/camera-manager/store';
import { type CameraEventCallback } from '../../src/camera-manager/types';
import type { StateWatcherSubscriptionInterface } from '../../src/card-controller/hass/state-watcher';
import { type CameraConfig } from '../../src/config/schema/cameras';
import type { EntityRegistryManager } from '../../src/ha/registry/entity/types';
import type { CapabilitiesRaw } from '../../src/types';
import { createCameraConfig } from '../config/test-utils';
import { createHASSManager } from '../test-utils';

export const createCapabilities = (capabilities?: CapabilitiesRaw): Capabilities => {
  return new Capabilities({
    'favorite-events': false,
    'favorite-recordings': false,
    'remote-control-entity': true,
    clips: false,
    live: false,
    recordings: false,
    seek: false,
    snapshots: false,
    trigger: true,
    ...capabilities,
  });
};

export const createInitializedCamera = async (
  config: CameraConfig,
  engine: CameraManagerEngine,
  capabilities?: Capabilities,
  stateWatcher?: StateWatcherSubscriptionInterface,
): Promise<Camera> => {
  const camera = new Camera(config, engine);
  await camera.initialize({
    hassManager: createHASSManager({ stateWatcher }),
    ...(capabilities ? { capabilityOptions: { capabilities } } : {}),
  });
  return camera;
};

export const createStore = (
  cameras?: {
    cameraID: string;
    engine?: CameraManagerEngine;
    config?: CameraConfig;
    capabilities?: Capabilities | null;
    eventCallback?: CameraEventCallback;
  }[],
): CameraManagerStore => {
  const store = new CameraManagerStore();
  for (const cameraProps of cameras ?? []) {
    const eventCallback = cameraProps.eventCallback ?? vi.fn();
    const capabilities =
      cameraProps.capabilities === undefined
        ? createCapabilities()
        : cameraProps.capabilities ?? undefined;
    const camera = new Camera(
      cameraProps.config ?? createCameraConfig(),
      cameraProps.engine ??
        new GenericCameraManagerEngine(
          createHASSManager(),
          mock<EntityRegistryManager>(),
          eventCallback,
        ),
      { eventCallback, capabilities },
    );
    camera.setID(cameraProps.cameraID);
    store.addCamera(camera);
  }
  return store;
};

export const createCameraManager = (store?: CameraManagerStore): CameraManager => {
  const cameraStore = store ?? createStore();
  const cameraManager = mock<CameraManager>();
  vi.mocked(cameraManager.getStore).mockReturnValue(cameraStore);
  vi.mocked(cameraManager.getCameraCapabilities).mockImplementation(
    (cameraID: string): Capabilities | null => {
      return cameraStore.getCamera(cameraID)?.getCapabilities() ?? null;
    },
  );

  return cameraManager;
};
