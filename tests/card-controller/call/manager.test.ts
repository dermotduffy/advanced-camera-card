import { assert, describe, expect, it, vi } from 'vitest';
import { CameraManagerStore } from '../../../src/camera-manager/store';
import { CallManager } from '../../../src/card-controller/call/manager';
import { CardController } from '../../../src/card-controller/controller';
import { SubstreamViewModifier } from '../../../src/card-controller/view/modifiers/substream';
import { ConditionStateChange } from '../../../src/conditions/types';
import { View } from '../../../src/view/view';
import {
  createCameraConfig,
  createCameraManager,
  createCapabilities,
  createCardAPI,
  createStore,
  createView,
} from '../../test-utils';

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

// The condition-state listener a CallManager registers in its constructor.
const getConditionStateListener = (
  api: CardController,
): ((change: ConditionStateChange) => void) => {
  const listener = vi.mocked(api.getConditionStateManager().addListener).mock
    .calls[0]?.[0];
  assert(listener);
  return listener;
};

describe('isActive', () => {
  it('should report inactive before a call starts', () => {
    expect(new CallManager(createCardAPI()).isActive()).toBe(false);
  });

  it('should report active during a call', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const manager = new CallManager(api);

    await manager.start();

    expect(manager.isActive()).toBe(true);
    // The call runs on the parent camera's own stream, so callCameraID is
    // absent.
    expect(manager.getCall()).toEqual({
      cameraID: 'camera.office',
      previousView: expect.any(View),
    });
    expect(manager.getCall()?.previousView?.view).toBe('live');
  });
});

describe('start', () => {
  it('should do nothing without a view camera', async () => {
    const api = createAPI({ view: createView({ camera: null }) });

    await new CallManager(api).start();

    expect(api.getViewManager().setViewByParameters).not.toBeCalled();
  });

  it('should do nothing when already active for the camera', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const manager = new CallManager(api);

    await manager.start();
    vi.mocked(api.getViewManager().setViewByParameters).mockClear();
    await manager.start();

    expect(api.getViewManager().setViewByParameters).not.toBeCalled();
  });

  it('should start a call on the selected camera', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });

    await new CallManager(api).start();

    expect(api.getViewManager().setViewByParameters).toBeCalledWith({
      modifiers: [expect.any(SubstreamViewModifier)],
      force: true,
    });
    expect(api.getConditionStateManager().setState).toBeCalledWith({ call: true });
  });

  it('should navigate to the live view when started from elsewhere', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office', view: 'clips' }),
    });

    await new CallManager(api).start();

    expect(api.getViewManager().setViewByParameters).toBeCalledWith({
      params: { view: 'live', camera: 'camera.office' },
      modifiers: [expect.any(SubstreamViewModifier)],
      force: true,
    });
  });

  it('should evolve the current view without params when already in live', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office', view: 'live' }),
    });

    await new CallManager(api).start();

    expect(api.getViewManager().setViewByParameters).toBeCalledWith({
      modifiers: [expect.any(SubstreamViewModifier)],
      force: true,
    });
    expect(api.getViewManager().setViewByParameters).not.toBeCalledWith(
      expect.objectContaining({ params: expect.anything() }),
    );
  });

  it('should record the view present when the call started', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office', view: 'clips' }),
    });
    const manager = new CallManager(api);

    await manager.start();

    const call = manager.getCall();
    expect(call?.previousView?.view).toBe('clips');
    expect(call?.previousView?.camera).toBe('camera.office');
    // Query results are dropped so they are re-fetched fresh on restore.
    expect(call?.previousView?.queryResults).toBeNull();
  });

  it('should record the live view when the call starts from live', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office', view: 'live' }),
    });
    const manager = new CallManager(api);

    await manager.start();

    const call = manager.getCall();
    expect(call?.previousView?.view).toBe('live');
    expect(call?.previousView?.camera).toBe('camera.office');
  });

  it('should keep the original pre-call view when a call supersedes another', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office', view: 'clips' }),
      store: createStore([
        {
          cameraID: 'camera.office',
          capabilities: createCapabilities({ live: true, '2-way-audio': true }),
        },
        {
          cameraID: 'camera.garage',
          capabilities: createCapabilities({ live: true, '2-way-audio': true }),
        },
      ]),
    });
    const manager = new CallManager(api);

    await manager.start();
    await manager.start('camera.garage');

    const call = manager.getCall();
    expect(call?.cameraID).toBe('camera.garage');
    expect(call?.previousView?.view).toBe('clips');
    expect(call?.previousView?.camera).toBe('camera.office');
  });

  it('should start a call from a non-camera view when a camera is explicit', async () => {
    const api = createAPI({
      view: createView({ camera: null, view: 'folder' }),
      store: createCallableStore('camera.office'),
    });
    const manager = new CallManager(api);

    await manager.start('camera.office');

    const call = manager.getCall();
    expect(call?.cameraID).toBe('camera.office');
    expect(call?.previousView?.view).toBe('folder');
    expect(call?.previousView?.camera).toBeNull();
    expect(api.getViewManager().setViewByParameters).toBeCalledWith({
      params: { view: 'live', camera: 'camera.office' },
      modifiers: [expect.any(SubstreamViewModifier)],
      force: true,
    });
  });

  it('should start the call on an explicit camera and navigate there', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      store: createStore([
        {
          cameraID: 'camera.office',
          capabilities: createCapabilities({ live: true, '2-way-audio': true }),
        },
        {
          cameraID: 'camera.garage',
          capabilities: createCapabilities({ live: true, '2-way-audio': true }),
        },
      ]),
    });
    const manager = new CallManager(api);

    await manager.start('camera.garage');

    const call = manager.getCall();
    expect(call?.cameraID).toBe('camera.garage');
    expect(call?.previousView?.view).toBe('live');
    expect(call?.previousView?.camera).toBe('camera.office');
    expect(api.getViewManager().setViewByParameters).toBeCalledWith({
      params: { view: 'live', camera: 'camera.garage' },
      modifiers: [expect.any(SubstreamViewModifier)],
      force: true,
    });
  });

  it('should start a call on an explicit stream of the parent camera', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      store: createStore([
        {
          cameraID: 'camera.office',
          config: createCameraConfig({
            dependencies: { cameras: ['camera.doorbell'] },
          }),
          capabilities: createCapabilities({ live: true }),
        },
        {
          cameraID: 'camera.doorbell',
          capabilities: createCapabilities({ live: true, '2-way-audio': true }),
        },
      ]),
    });
    const manager = new CallManager(api);

    await manager.start('camera.office', 'camera.doorbell');

    const call = manager.getCall();
    expect(call?.cameraID).toBe('camera.office');
    expect(call?.callCameraID).toBe('camera.doorbell');
    expect(call?.previousView?.view).toBe('live');
  });

  it('should abort when the requested camera is not a live camera', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });

    await new CallManager(api).start('camera.unknown');

    expect(api.getViewManager().setViewByParameters).not.toBeCalled();
    expect(api.getNotificationManager().setNotification).toBeCalled();
  });

  it('should abort when the requested stream is not 2-way audio of the parent camera', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      store: createStore([
        {
          cameraID: 'camera.office',
          capabilities: createCapabilities({ live: true, '2-way-audio': true }),
        },
        {
          cameraID: 'camera.unrelated',
          capabilities: createCapabilities({ live: true, '2-way-audio': true }),
        },
      ]),
    });

    await new CallManager(api).start('camera.office', 'camera.unrelated');

    expect(api.getViewManager().setViewByParameters).not.toBeCalled();
    expect(api.getNotificationManager().setNotification).toBeCalled();
  });

  it('should supersede an active call on a different camera', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      store: createStore([
        {
          cameraID: 'camera.office',
          capabilities: createCapabilities({ live: true, '2-way-audio': true }),
        },
        {
          cameraID: 'camera.garage',
          capabilities: createCapabilities({ live: true, '2-way-audio': true }),
        },
      ]),
    });
    const manager = new CallManager(api);

    await manager.start();
    await manager.start('camera.garage');

    const call = manager.getCall();
    expect(call?.cameraID).toBe('camera.garage');
    expect(call?.previousView?.view).toBe('live');
    expect(call?.previousView?.camera).toBe('camera.office');
    expect(api.getConditionStateManager().setState).toBeCalledWith({ call: false });
    expect(api.getConditionStateManager().setState).toBeCalledWith({ call: true });
  });

  it('should restart on the same camera with a different stream', async () => {
    const api = createAPI({
      store: createStore([
        {
          cameraID: 'camera.office',
          config: createCameraConfig({
            dependencies: { cameras: ['camera.doorbell', 'camera.intercom'] },
          }),
          capabilities: createCapabilities({ live: true, '2-way-audio': true }),
        },
        {
          cameraID: 'camera.doorbell',
          capabilities: createCapabilities({ live: true, '2-way-audio': true }),
        },
        {
          cameraID: 'camera.intercom',
          capabilities: createCapabilities({ live: true, '2-way-audio': true }),
        },
      ]),
    });

    // The first call engages `camera.doorbell`; the view then reflects that
    // substream, as it would at runtime when the second call_start arrives.
    vi.mocked(api.getViewManager().getView)
      .mockReturnValueOnce(createView({ camera: 'camera.office' }))
      .mockReturnValue(
        createView({
          camera: 'camera.office',
          context: {
            live: { overrides: new Map([['camera.office', 'camera.doorbell']]) },
          },
        }),
      );
    const manager = new CallManager(api);

    await manager.start('camera.office', 'camera.doorbell');
    await manager.start('camera.office', 'camera.intercom');

    // The restarted call carries the new stream; the recorded pre-call view
    // keeps the genuine pre-call substream (none -- the camera's own stream), not the
    // superseded call's engaged `camera.doorbell`.
    const call = manager.getCall();
    expect(call?.cameraID).toBe('camera.office');
    expect(call?.callCameraID).toBe('camera.intercom');
    expect(
      call?.previousView?.context?.live?.overrides?.get('camera.office'),
    ).toBeUndefined();
  });

  it('should abort when no stream supports 2-way audio', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      store: createStore([
        { cameraID: 'camera.office', capabilities: createCapabilities({ live: true }) },
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
          capabilities: createCapabilities({ live: true, '2-way-audio': true }),
        },
        {
          cameraID: 'camera.sub',
          capabilities: createCapabilities({ '2-way-audio': true }),
        },
      ]),
    });
    const manager = new CallManager(api);

    await manager.start();

    expect(api.getViewManager().setViewByParameters).toBeCalledWith({
      modifiers: [expect.any(SubstreamViewModifier)],
      force: true,
    });
    // The pre-call substream is captured in the recorded view's context so it
    // can be restored on call end.
    expect(
      manager.getCall()?.previousView?.context?.live?.overrides?.get('camera.office'),
    ).toBe('camera.sub');
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
      modifiers: [expect.any(SubstreamViewModifier)],
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

  it('should end an active call', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const manager = new CallManager(api);
    await manager.start();
    vi.mocked(api.getViewManager().setViewByParameters).mockClear();

    manager.end();

    expect(manager.isActive()).toBe(false);
    expect(api.getViewManager().setViewByParameters).toBeCalledWith({
      modifiers: [expect.any(SubstreamViewModifier)],
      force: true,
    });
    expect(api.getConditionStateManager().setState).toBeCalledWith({ call: false });
  });

  it('should restore the pre-call substream when ending', async () => {
    const api = createAPI({
      view: createView({
        camera: 'camera.office',
        context: { live: { overrides: new Map([['camera.office', 'camera.sub']]) } },
      }),
      store: createStore([
        {
          cameraID: 'camera.office',
          capabilities: createCapabilities({ live: true, '2-way-audio': true }),
        },
        {
          cameraID: 'camera.sub',
          capabilities: createCapabilities({ '2-way-audio': true }),
        },
      ]),
    });
    const manager = new CallManager(api);
    await manager.start();
    vi.mocked(api.getViewManager().setViewByParameters).mockClear();

    manager.end();

    // The recorded pre-call substream (`camera.sub`) is reinstated.
    expect(api.getViewManager().setViewByParameters).toBeCalledWith({
      modifiers: [expect.any(SubstreamViewModifier)],
      force: true,
    });
  });

  it('should return to the pre-call view on an explicit end', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office', view: 'clips' }),
    });
    const manager = new CallManager(api);
    await manager.start();

    manager.end();

    expect(api.getViewManager().setViewByParametersWithExistingQuery).toBeCalledWith({
      baseView: expect.any(View),
      force: true,
    });
    const restored = vi.mocked(api.getViewManager().setViewByParametersWithExistingQuery)
      .mock.calls[0]?.[0];
    expect(restored?.baseView?.view).toBe('clips');
    expect(restored?.baseView?.camera).toBe('camera.office');
  });

  it('should not navigate on an explicit end when the call started from live', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office', view: 'live' }),
    });
    const manager = new CallManager(api);
    await manager.start();
    vi.mocked(api.getViewManager().setViewByParameters).mockClear();

    manager.end();

    // No navigation: only the substream is undone.
    expect(api.getViewManager().setViewByParameters).toBeCalledWith({
      modifiers: [expect.any(SubstreamViewModifier)],
      force: true,
    });
    expect(api.getViewManager().setViewByParametersWithExistingQuery).not.toBeCalled();
  });

  it('should return to a camera-less pre-call view on an explicit end', async () => {
    const api = createAPI({
      view: createView({ camera: null, view: 'folder' }),
      store: createCallableStore('camera.office'),
    });
    const manager = new CallManager(api);
    await manager.start('camera.office');

    manager.end();

    const restored = vi.mocked(api.getViewManager().setViewByParametersWithExistingQuery)
      .mock.calls[0]?.[0];
    expect(restored?.baseView?.view).toBe('folder');
    expect(restored?.baseView?.camera).toBeNull();
  });
});

describe('condition state changes', () => {
  it('should end the call when the selected camera changes away', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const manager = new CallManager(api);
    await manager.start();
    vi.mocked(api.getViewManager().setViewByParameters).mockClear();

    getConditionStateListener(api)({
      old: { camera: 'camera.office', view: 'live' },
      change: { camera: 'camera.other' },
      new: { camera: 'camera.other', view: 'live' },
    });

    expect(manager.isActive()).toBe(false);
    expect(api.getViewManager().setViewByParameters).toBeCalledWith({
      modifiers: [expect.any(SubstreamViewModifier)],
      force: true,
    });
  });

  it('should not restore the pre-call view when the call auto-ends', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office', view: 'clips' }),
    });
    const manager = new CallManager(api);
    await manager.start();
    vi.mocked(api.getViewManager().setViewByParameters).mockClear();

    getConditionStateListener(api)({
      old: { camera: 'camera.office', view: 'live' },
      change: { camera: 'camera.other' },
      new: { camera: 'camera.other', view: 'live' },
    });

    expect(manager.isActive()).toBe(false);
    expect(api.getViewManager().setViewByParametersWithExistingQuery).not.toBeCalled();
  });

  it('should end the call when the view leaves live', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const manager = new CallManager(api);
    await manager.start();
    vi.mocked(api.getViewManager().setViewByParameters).mockClear();

    getConditionStateListener(api)({
      old: { camera: 'camera.office', view: 'live' },
      change: { view: 'clips' },
      new: { camera: 'camera.office', view: 'clips' },
    });

    expect(manager.isActive()).toBe(false);
    expect(api.getViewManager().setViewByParameters).toBeCalledWith({
      modifiers: [expect.any(SubstreamViewModifier)],
      force: true,
    });
  });

  it('should keep the call when the selected camera is unchanged', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const manager = new CallManager(api);
    await manager.start();

    getConditionStateListener(api)({
      old: { camera: 'camera.office' },
      change: { view: 'live' },
      new: { camera: 'camera.office', view: 'live' },
    });

    expect(manager.isActive()).toBe(true);
  });

  it('should no-op when no call is active', () => {
    const api = createAPI();
    new CallManager(api);

    getConditionStateListener(api)({
      old: {},
      change: { camera: 'camera.other' },
      new: { camera: 'camera.other' },
    });

    expect(api.getViewManager().setViewByParameters).not.toBeCalled();
  });

  it('should end the call when the substream changes away', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const manager = new CallManager(api);
    await manager.start();

    getConditionStateListener(api)({
      old: { camera: 'camera.office', view: 'live' },
      change: { substreamID: 'camera.sub' },
      new: { camera: 'camera.office', substreamID: 'camera.sub', view: 'live' },
    });

    expect(manager.isActive()).toBe(false);
  });

  it('should keep the call when the substream is unchanged', async () => {
    const api = createAPI({
      view: createView({
        camera: 'camera.office',
        context: { live: { overrides: new Map([['camera.office', 'camera.sub']]) } },
      }),
      store: createStore([
        {
          cameraID: 'camera.office',
          capabilities: createCapabilities({ live: true, '2-way-audio': true }),
        },
        {
          cameraID: 'camera.sub',
          capabilities: createCapabilities({ '2-way-audio': true }),
        },
      ]),
    });
    const manager = new CallManager(api);
    await manager.start();

    getConditionStateListener(api)({
      old: { camera: 'camera.office', substreamID: 'camera.sub' },
      change: { view: 'live' },
      new: { camera: 'camera.office', substreamID: 'camera.sub', view: 'live' },
    });

    expect(manager.isActive()).toBe(true);
  });
});
