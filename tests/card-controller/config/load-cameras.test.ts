import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { Camera } from '../../../src/camera-manager/camera';
import type { CameraManagerEngine } from '../../../src/camera-manager/engine';
import {
  CameraFactory,
  type CameraFactoryOptions,
} from '../../../src/camera-manager/factory';
import type * as CameraFactoryModule from '../../../src/camera-manager/factory';
import { CameraLifecycleStatus } from '../../../src/camera-manager/lifecycle';
import type { CameraEvent } from '../../../src/camera-manager/types';
import { setCamerasFromConfig } from '../../../src/card-controller/config/load-cameras';
import { advancedCameraCardConfigSchema } from '../../../src/config/schema/types';
import { createCameraConfig, createConfig } from '../../config/test-utils';
import { createCardAPI, createHASS, createHASSManager } from '../../test-utils';

// Spy on the factory construction so the default-factory wiring can be
// inspected, while still building real cameras via the real factory.
vi.mock('../../../src/camera-manager/factory', async (importOriginal) => {
  const actual = await importOriginal<typeof CameraFactoryModule>();
  return {
    ...actual,
    CameraFactory: vi.fn(function (
      engineFactory: ConstructorParameters<typeof actual.CameraFactory>[0],
      options: CameraFactoryOptions,
    ) {
      return new actual.CameraFactory(engineFactory, options);
    }),
  };
});

describe('setCamerasFromConfig', () => {
  it('should do nothing without a config', async () => {
    const api = createCardAPI();
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
    const factory = mock<CameraFactory>();

    await setCamerasFromConfig(api, factory);

    expect(factory.buildCameras).not.toHaveBeenCalled();
    expect(api.getCameraManager().setCameras).not.toHaveBeenCalled();
  });

  it('should do nothing without hass', async () => {
    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(null);
    const factory = mock<CameraFactory>();

    await setCamerasFromConfig(api, factory);

    expect(factory.buildCameras).not.toHaveBeenCalled();
    expect(api.getCameraManager().setCameras).not.toHaveBeenCalled();
  });

  it('should build no cameras when the config has none', async () => {
    const api = createCardAPI();
    const hass = createHASS();
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      advancedCameraCardConfigSchema.parse({ type: 'custom:advanced-camera-card' }),
    );

    const factory = mock<CameraFactory>();
    vi.mocked(factory.buildCameras).mockResolvedValue([]);

    await setCamerasFromConfig(api, factory);

    expect(factory.buildCameras).toHaveBeenCalledWith(hass, []);
  });

  it('should merge global camera config and hand built cameras to the manager', async () => {
    const api = createCardAPI();
    const hass = createHASS();
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        cameras: [{ id: 'one', engine: 'generic' }],
        cameras_global: { title: 'GLOBAL' },
        performance: { features: { max_simultaneous_engine_requests: 4 } },
      }),
    );

    const camera = new Camera(
      createCameraConfig({ id: 'one' }),
      mock<CameraManagerEngine>(),
      { hassManager: createHASSManager() },
    );
    const factory = mock<CameraFactory>();
    vi.mocked(factory.buildCameras).mockResolvedValue([camera]);

    await setCamerasFromConfig(api, factory);

    expect(factory.buildCameras).toHaveBeenCalledWith(hass, [
      expect.objectContaining({ id: 'one', title: 'GLOBAL' }),
    ]);
    expect(api.getCameraManager().setCameras).toHaveBeenCalledWith(
      [camera],
      expect.objectContaining({ engineRequestConcurrency: 4 }),
    );
  });

  it('should build cameras with the default factory', async () => {
    const api = createCardAPI();
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        cameras: [{ id: 'one', engine: 'generic' }],
      }),
    );

    await setCamerasFromConfig(api);

    expect(api.getCameraManager().setCameras).toHaveBeenCalledWith(
      [expect.any(Camera)],
      expect.objectContaining({ engineRequestConcurrency: undefined }),
    );
  });

  it('should wire the default factory to forward camera events to the triggers manager', async () => {
    const api = createCardAPI();
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        cameras: [{ id: 'one', engine: 'generic' }],
      }),
    );

    await setCamerasFromConfig(api);

    // The default factory is constructed with an eventCallback that forwards
    // camera events to the triggers manager.
    const cameraEvent: CameraEvent = {
      cameraID: 'one',
      id: 'event-1',
      type: 'new',
    };
    const factoryOptions = vi.mocked(CameraFactory).mock.calls.at(-1)?.[1];
    factoryOptions?.eventCallback?.(cameraEvent);

    expect(api.getCameraTriggersManager().handleCameraEvent).toHaveBeenCalledWith(
      cameraEvent,
    );
  });

  it('should wire the lifecycle callback to update the card and handle readiness', async () => {
    const api = createCardAPI();
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        cameras: [{ id: 'one', engine: 'generic' }],
      }),
    );

    vi.mocked(
      api.getCameraTriggersManager().handleCameraLifecycleChange,
    ).mockResolvedValue(true);
    vi.mocked(api.getViewManager().handleCameraLifecycleChange).mockResolvedValue();

    await setCamerasFromConfig(api);

    const lifecycleCallback = vi.mocked(api.getCameraManager().setCameras).mock
      .calls[0][1]?.lifecycleCallback;
    expect(lifecycleCallback).toBeDefined();

    lifecycleCallback?.('one', { status: CameraLifecycleStatus.Ready });

    expect(api.getCardElementManager().update).toHaveBeenCalled();
    expect(
      api.getCameraTriggersManager().handleCameraLifecycleChange,
    ).toHaveBeenCalledWith('one');
    expect(api.getViewManager().handleCameraLifecycleChange).toHaveBeenCalled();
  });

  it('should update the card but not handle readiness for non-ready states', async () => {
    const api = createCardAPI();
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        cameras: [{ id: 'one', engine: 'generic' }],
      }),
    );

    await setCamerasFromConfig(api);

    const lifecycleCallback = vi.mocked(api.getCameraManager().setCameras).mock
      .calls[0][1]?.lifecycleCallback;

    lifecycleCallback?.('one', { status: CameraLifecycleStatus.Initializing });

    expect(api.getCardElementManager().update).toHaveBeenCalled();
    expect(
      api.getCameraTriggersManager().handleCameraLifecycleChange,
    ).not.toHaveBeenCalled();
    expect(api.getViewManager().handleCameraLifecycleChange).not.toHaveBeenCalled();
  });

  it('should contain a callback failure without rejecting', async () => {
    const api = createCardAPI();
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        cameras: [{ id: 'one', engine: 'generic' }],
      }),
    );
    vi.mocked(
      api.getCameraTriggersManager().handleCameraLifecycleChange,
    ).mockRejectedValue(new Error('callback failed'));
    vi.mocked(api.getViewManager().handleCameraLifecycleChange).mockRejectedValue(
      new Error('callback failed'),
    );

    await setCamerasFromConfig(api);

    const lifecycleCallback = vi.mocked(api.getCameraManager().setCameras).mock
      .calls[0][1]?.lifecycleCallback;

    // Reaching here without an unhandled rejection is the assertion.
    lifecycleCallback?.('one', { status: CameraLifecycleStatus.Ready });
  });
});
