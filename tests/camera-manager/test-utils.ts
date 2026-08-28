import { expect, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { Camera } from '../../src/camera-manager/camera';
import { Capabilities } from '../../src/camera-manager/capabilities';
import type { CameraManagerEngine } from '../../src/camera-manager/engine';
import { GenericCameraManagerEngine } from '../../src/camera-manager/generic/engine-generic';
import {
  CameraLifecycleStatus,
  type CameraLifecycleState,
} from '../../src/camera-manager/lifecycle';
import type { CameraManager } from '../../src/camera-manager/manager';
import { CameraManagerStore } from '../../src/camera-manager/store';
import { type CameraEventCallback } from '../../src/camera-manager/types';
import type { StateWatcherSubscriptionInterface } from '../../src/card-controller/hass/state-watcher';
import { type CameraConfig } from '../../src/config/schema/cameras';
import type { EntityRegistryManager } from '../../src/ha/registry/entity/types';
import type { HomeAssistant } from '../../src/ha/types';
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

export class TestCamera extends Camera {
  private _overriddenCapabilities: Capabilities | null = null;

  public setCapabilities(capabilities?: Capabilities): this {
    this._overriddenCapabilities = capabilities ?? null;
    return this;
  }

  public override getCapabilities(): Capabilities {
    return this._overriddenCapabilities ?? super.getCapabilities();
  }

  protected override async _buildCapabilities(
    hass: HomeAssistant,
  ): Promise<Capabilities> {
    return this._overriddenCapabilities ?? (await super._buildCapabilities(hass));
  }
}

export const createCameraFromConfig = (
  config?: CameraConfig,
  options?: { cameraID?: string; engine?: CameraManagerEngine },
): Camera => {
  const camera = new TestCamera(
    config ?? createCameraConfig(),
    options?.engine ?? mock<CameraManagerEngine>(),
    { hassManager: createHASSManager() },
  );
  camera.setID(options?.cameraID ?? 'camera-1');
  return camera;
};

export const createInitializedCamera = async (
  config: CameraConfig,
  engine: CameraManagerEngine,
  capabilities?: Capabilities,
  stateWatcher?: StateWatcherSubscriptionInterface,
): Promise<Camera> => {
  const camera = new TestCamera(config, engine, {
    hassManager: createHASSManager({ stateWatcher }),
  }).setCapabilities(capabilities);
  await camera.initialize();
  return camera;
};

export const createSubscribedCamera = async (
  config: CameraConfig,
  engine: CameraManagerEngine,
  capabilities?: Capabilities,
  stateWatcher?: StateWatcherSubscriptionInterface,
): Promise<Camera> => {
  const camera = await createInitializedCamera(
    config,
    engine,
    capabilities,
    stateWatcher,
  );
  camera.subscribe();
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
  const built: Camera[] = [];
  for (const cameraProps of cameras ?? []) {
    const eventCallback = cameraProps.eventCallback ?? vi.fn();
    const capabilities =
      cameraProps.capabilities === undefined
        ? createCapabilities()
        : cameraProps.capabilities ?? undefined;
    const camera = new TestCamera(
      cameraProps.config ?? createCameraConfig(),
      cameraProps.engine ??
        new GenericCameraManagerEngine(
          createHASSManager(),
          mock<EntityRegistryManager>(),
          eventCallback,
        ),
      { hassManager: createHASSManager() },
      { eventCallback },
    ).setCapabilities(capabilities);
    camera.setID(cameraProps.cameraID);
    built.push(camera);
  }
  store.setCameras(built);
  return store;
};

/**
 * Wait for a camera manager to finish initializing its cameras, which it does in
 * the background.
 */
export const waitForCameraInitialization = async (
  manager: CameraManager,
): Promise<void> => {
  await vi.waitFor(() =>
    expect(
      [...manager.getStore().getCameraIDs()].some((cameraID) =>
        manager.isCameraInitializing(cameraID),
      ),
    ).toBe(false),
  );
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

  // Cameras placed directly in a store by tests represent fully-initialized
  // cameras, so their lifecycle defaults to ready. The store is re-read on
  // every call, since tests may re-mock getStore() after this factory runs.
  vi.mocked(cameraManager.getCameraLifecycleState).mockImplementation(
    (cameraID: string): CameraLifecycleState | null => {
      return cameraManager.getStore().hasCameraID(cameraID)
        ? { status: CameraLifecycleStatus.Ready }
        : null;
    },
  );
  vi.mocked(cameraManager.isCameraReady).mockImplementation((cameraID: string) =>
    cameraManager.getStore().hasCameraID(cameraID),
  );
  vi.mocked(cameraManager.isCameraInitializing).mockReturnValue(false);

  vi.mocked(cameraManager.getEpoch).mockImplementation(() => ({
    manager: cameraManager,
  }));

  return cameraManager;
};
