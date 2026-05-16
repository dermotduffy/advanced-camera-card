import { describe, expect, it, vi } from 'vitest';
import { CameraManagerStore } from '../../src/camera-manager/store';
import { CallManager } from '../../src/card-controller/call-manager';
import { CardController } from '../../src/card-controller/controller';
import {
  CallClearViewModifier,
  CallSetViewModifier,
} from '../../src/components-lib/live/call';
import { View } from '../../src/view/view';
import {
  createCameraConfig,
  createCameraManager,
  createCapabilities,
  createCardAPI,
  createStore,
  createView,
} from '../test-utils';

// A store with a single 2-way-audio-capable camera.
const createCallableStore = (cameraID = 'camera.office'): CameraManagerStore =>
  createStore([
    {
      cameraID,
      capabilities: createCapabilities({ live: true, '2-way-audio': true }),
    },
  ]);

const createAPI = (options?: {
  view?: View | null;
  store?: CameraManagerStore;
  microphoneSupported?: boolean;
  microphoneForbidden?: boolean;
  microphoneConnected?: boolean;
}): CardController => {
  const api = createCardAPI();
  vi.mocked(api.getViewManager().getView).mockReturnValue(options?.view ?? null);
  vi.mocked(api.getCameraManager).mockReturnValue(
    createCameraManager(options?.store ?? createCallableStore()),
  );
  vi.mocked(api.getMicrophoneManager().isSupported).mockReturnValue(
    options?.microphoneSupported ?? true,
  );
  vi.mocked(api.getMicrophoneManager().isForbidden).mockReturnValue(
    options?.microphoneForbidden ?? false,
  );
  vi.mocked(api.getMicrophoneManager().isConnected).mockReturnValue(
    options?.microphoneConnected ?? true,
  );
  return api;
};

describe('isActive', () => {
  it('should report inactive without a call context', () => {
    expect(new CallManager(createCardAPI()).isActive(createView())).toBe(false);
  });

  it('should report active with a call context', () => {
    const view = createView({
      camera: 'camera.office',
      context: { call: { cameraID: 'camera.office', callCameraID: 'camera.office' } },
    });
    expect(new CallManager(createCardAPI()).isActive(view)).toBe(true);
  });
});

describe('start', () => {
  it('should do nothing without a view camera', async () => {
    const api = createAPI({ view: createView({ camera: null }) });

    await new CallManager(api).start();

    expect(api.getViewManager().setViewByParameters).not.toBeCalled();
  });

  it('should do nothing when already active for the camera', async () => {
    const api = createAPI({
      view: createView({
        camera: 'camera.office',
        context: { call: { cameraID: 'camera.office', callCameraID: 'camera.office' } },
      }),
    });

    await new CallManager(api).start();

    expect(api.getViewManager().setViewByParameters).not.toBeCalled();
  });

  it('should start a call on the selected camera', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });

    await new CallManager(api).start();

    expect(api.getViewManager().setViewByParameters).toBeCalledWith({
      modifiers: [expect.any(CallSetViewModifier)],
      force: true,
    });
    expect(api.getConditionStateManager().setState).toBeCalledWith({ call: true });
  });

  it('should start a call on an explicit 2-way-audio camera', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      store: createCallableStore('camera.doorbell'),
    });

    await new CallManager(api).start('camera.doorbell');

    expect(api.getViewManager().setViewByParameters).toBeCalledWith({
      modifiers: [expect.any(CallSetViewModifier)],
      force: true,
    });
  });

  it('should abort when an explicit camera lacks 2-way audio', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      store: createStore([
        { cameraID: 'camera.office', capabilities: createCapabilities() },
      ]),
    });

    await new CallManager(api).start('camera.office');

    expect(api.getViewManager().setViewByParameters).not.toBeCalled();
    expect(api.getNotificationManager().setNotification).toBeCalled();
  });

  it('should abort when no camera supports 2-way audio', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      store: createStore([
        { cameraID: 'camera.office', capabilities: createCapabilities() },
      ]),
    });

    await new CallManager(api).start();

    expect(api.getViewManager().setViewByParameters).not.toBeCalled();
    expect(api.getNotificationManager().setNotification).toBeCalled();
  });

  it('should engage the active substream when it is call-capable', async () => {
    const api = createAPI({
      view: createView({
        camera: 'camera.office',
        context: { live: { overrides: new Map([['camera.office', 'camera.sub']]) } },
      }),
      store: createStore([
        {
          cameraID: 'camera.office',
          capabilities: createCapabilities({ '2-way-audio': true }),
        },
        {
          cameraID: 'camera.sub',
          capabilities: createCapabilities({ '2-way-audio': true }),
        },
      ]),
    });

    await new CallManager(api).start();

    expect(api.getViewManager().setViewByParameters).toBeCalledWith({
      modifiers: [expect.any(CallSetViewModifier)],
      force: true,
    });
  });

  it('should fall back to a call-capable dependency when the parent lacks audio', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      store: createStore([
        {
          cameraID: 'camera.office',
          config: createCameraConfig({ dependencies: { cameras: ['camera.doorbell'] } }),
          capabilities: createCapabilities({ live: true }),
        },
        {
          cameraID: 'camera.doorbell',
          capabilities: createCapabilities({ live: true, '2-way-audio': true }),
        },
      ]),
    });

    await new CallManager(api).start();

    expect(api.getViewManager().setViewByParameters).toBeCalledWith({
      modifiers: [expect.any(CallSetViewModifier)],
      force: true,
    });
  });

  it('should abort when the microphone is unsupported', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneSupported: false,
    });

    await new CallManager(api).start();

    expect(api.getViewManager().setViewByParameters).not.toBeCalled();
    expect(api.getNotificationManager().setNotification).toBeCalled();
  });

  it('should abort when the microphone is forbidden', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneForbidden: true,
    });

    await new CallManager(api).start();

    expect(api.getViewManager().setViewByParameters).not.toBeCalled();
    expect(api.getNotificationManager().setNotification).toBeCalled();
  });

  it('should connect the microphone when not already connected', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneConnected: false,
    });
    vi.mocked(api.getMicrophoneManager().connect).mockResolvedValue();

    await new CallManager(api).start();

    expect(api.getMicrophoneManager().connect).toBeCalled();
    expect(api.getViewManager().setViewByParameters).toBeCalled();
  });

  it('should abort when connecting the microphone fails', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneConnected: false,
    });
    vi.mocked(api.getMicrophoneManager().connect).mockRejectedValue(new Error());

    await new CallManager(api).start();

    expect(api.getViewManager().setViewByParameters).not.toBeCalled();
    expect(api.getNotificationManager().setNotification).toBeCalled();
  });
});

describe('end', () => {
  it('should do nothing when no call is active', () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });

    new CallManager(api).end();

    expect(api.getViewManager().setViewByParameters).not.toBeCalled();
  });

  it('should end an active call', () => {
    const api = createAPI({
      view: createView({
        camera: 'camera.office',
        context: { call: { cameraID: 'camera.office', callCameraID: 'camera.office' } },
      }),
    });

    new CallManager(api).end();

    expect(api.getViewManager().setViewByParameters).toBeCalledWith({
      modifiers: [expect.any(CallClearViewModifier)],
      force: true,
    });
    expect(api.getConditionStateManager().setState).toBeCalledWith({ call: false });
  });
});
