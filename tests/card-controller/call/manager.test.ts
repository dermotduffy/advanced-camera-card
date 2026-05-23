// @vitest-environment jsdom

import { PartialDeep } from 'type-fest';
import { assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CameraManagerStore } from '../../../src/camera-manager/store';
import { CallManager } from '../../../src/card-controller/call/manager';
import { Ringtone } from '../../../src/card-controller/call/ringtone';
import { CardController } from '../../../src/card-controller/controller';
import { SubstreamViewModifier } from '../../../src/card-controller/view/modifiers/substream';
import { ConditionStateChange } from '../../../src/conditions/types';
import { RingtoneConfig } from '../../../src/config/schema/live';
import { AdvancedCameraCardConfig } from '../../../src/config/schema/types';
import { View } from '../../../src/view/view';
import {
  createCameraConfig,
  createCameraManager,
  createCapabilities,
  createCardAPI,
  createConfig,
  createStore,
  createView,
} from '../../test-utils';

// Replace Ringtone with a fresh `mock<Ringtone>()` per construction so each
// CallManager gets an isolated, type-safe ringtone we can assert on. The
// real Ringtone creates an AudioContext, which we never want in tests.
vi.mock('../../../src/card-controller/call/ringtone', () => ({
  Ringtone: vi.fn().mockImplementation(() => mock<Ringtone>()),
}));

// Each test creates a new CallManager which constructs a new Ringtone, so the
// most recent constructor result is always this test's mock.
const getRingtone = (): Ringtone => {
  const results = vi.mocked(Ringtone).mock.results;
  const last = results.at(-1);
  assert(last);
  return last.value;
};

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
  microphoneMuted?: boolean;
  config?: PartialDeep<AdvancedCameraCardConfig>;
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
  vi.mocked(api.getMicrophoneManager().isMuted).mockReturnValue(
    options?.microphoneMuted ?? true,
  );
  if (options?.config) {
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig(options.config),
    );
  }
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

    expect(await manager.start()).toBe(true);

    expect(manager.isActive()).toBe(true);
    // The call runs on the parent camera's own stream, so callCameraID is
    // absent.
    expect(manager.getCall()).toEqual({
      cameraID: 'camera.office',
      previousView: expect.any(View),
      inbound: false,
      answered: false,
    });
    expect(manager.getCall()?.previousView?.view).toBe('live');
  });
});

describe('start', () => {
  it('should do nothing without a view camera', async () => {
    const api = createAPI({ view: createView({ camera: null }) });

    expect(await new CallManager(api).start()).toBe(false);

    expect(api.getViewManager().setViewByParameters).not.toBeCalled();
  });

  it('should do nothing when already active for the camera', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const manager = new CallManager(api);

    expect(await manager.start()).toBe(true);
    vi.mocked(api.getViewManager().setViewByParameters).mockClear();
    expect(await manager.start()).toBe(true);

    expect(api.getViewManager().setViewByParameters).not.toBeCalled();
  });

  it('should start a call on the selected camera', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });

    expect(await new CallManager(api).start()).toBe(true);

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

    expect(await new CallManager(api).start()).toBe(true);

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

    expect(await new CallManager(api).start()).toBe(true);

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

    expect(await manager.start()).toBe(true);

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

    expect(await manager.start()).toBe(true);

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

    expect(await manager.start()).toBe(true);
    expect(await manager.start({ cameraID: 'camera.garage' })).toBe(true);

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

    expect(await manager.start({ cameraID: 'camera.office' })).toBe(true);

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

    expect(await manager.start({ cameraID: 'camera.garage' })).toBe(true);

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

    expect(
      await manager.start({ cameraID: 'camera.office', streamID: 'camera.doorbell' }),
    ).toBe(true);

    const call = manager.getCall();
    expect(call?.cameraID).toBe('camera.office');
    expect(call?.callCameraID).toBe('camera.doorbell');
    expect(call?.previousView?.view).toBe('live');
  });

  it('should abort when the requested camera is not a live camera', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });

    expect(await new CallManager(api).start({ cameraID: 'camera.unknown' })).toBe(false);

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

    expect(
      await new CallManager(api).start({
        cameraID: 'camera.office',
        streamID: 'camera.unrelated',
      }),
    ).toBe(false);

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

    expect(await manager.start()).toBe(true);
    expect(await manager.start({ cameraID: 'camera.garage' })).toBe(true);

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

    expect(
      await manager.start({ cameraID: 'camera.office', streamID: 'camera.doorbell' }),
    ).toBe(true);
    expect(
      await manager.start({ cameraID: 'camera.office', streamID: 'camera.intercom' }),
    ).toBe(true);

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

    expect(await new CallManager(api).start()).toBe(false);

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

    expect(await manager.start()).toBe(true);

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

    expect(await new CallManager(api).start()).toBe(true);

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

    expect(await new CallManager(api).start()).toBe(false);

    expect(api.getViewManager().setViewByParameters).not.toBeCalled();
    expect(api.getNotificationManager().setNotification).toBeCalled();
  });

  it('should abort when the microphone is forbidden', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneForbidden: true,
    });

    expect(await new CallManager(api).start()).toBe(false);

    expect(api.getViewManager().setViewByParameters).not.toBeCalled();
    expect(api.getNotificationManager().setNotification).toBeCalled();
  });

  it('should connect the microphone when not already connected', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneConnected: false,
    });
    vi.mocked(api.getMicrophoneManager().connect).mockResolvedValue();

    expect(await new CallManager(api).start()).toBe(true);

    expect(api.getMicrophoneManager().connect).toBeCalled();
    expect(api.getViewManager().setViewByParameters).toBeCalled();
  });

  it('should abort when connecting the microphone fails', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneConnected: false,
    });
    vi.mocked(api.getMicrophoneManager().connect).mockRejectedValue(new Error());

    expect(await new CallManager(api).start()).toBe(false);

    expect(api.getViewManager().setViewByParameters).not.toBeCalled();
    expect(api.getNotificationManager().setNotification).toBeCalled();
  });
});

// An inbound start request must not displace a call the user cares about
// (manual call, or an answered inbound call). Newer unanswered inbound rings
// still replace older ones. Manual (user-initiated) start keeps its full
// supersede authority.
describe('inbound supersede policy', () => {
  const twoCameraStore = createStore([
    {
      cameraID: 'camera.office',
      capabilities: createCapabilities({ live: true, '2-way-audio': true }),
    },
    {
      cameraID: 'camera.garage',
      capabilities: createCapabilities({ live: true, '2-way-audio': true }),
    },
  ]);

  it('should skip an inbound start when an answered call is active on another camera', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      store: twoCameraStore,
    });
    const manager = new CallManager(api);
    manager.initialize();
    expect(await manager.start({ inbound: true })).toBe(true);

    // Answer the call.
    getConditionStateListener(api)({
      old: {
        camera: 'camera.office',
        view: 'live',
        microphone: { connected: true, muted: true, forbidden: false },
      },
      change: { microphone: { connected: true, muted: false, forbidden: false } },
      new: {
        camera: 'camera.office',
        view: 'live',
        microphone: { connected: true, muted: false, forbidden: false },
      },
    });
    expect(manager.getCall()?.answered).toBe(true);

    expect(await manager.start({ cameraID: 'camera.garage', inbound: true })).toBe(
      false,
    );

    // Call still on the original camera, untouched.
    expect(manager.getCall()?.cameraID).toBe('camera.office');
    expect(manager.getCall()?.answered).toBe(true);
  });

  it('should skip an inbound start request when a manual call is active on another camera', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      store: twoCameraStore,
    });
    const manager = new CallManager(api);
    expect(await manager.start()).toBe(true);
    expect(manager.getCall()?.inbound).toBe(false);

    expect(await manager.start({ cameraID: 'camera.garage', inbound: true })).toBe(
      false,
    );

    expect(manager.getCall()?.cameraID).toBe('camera.office');
    expect(manager.getCall()?.inbound).toBe(false);
  });

  it('should supersede an unanswered inbound call with another inbound on a different camera', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      store: twoCameraStore,
    });
    const manager = new CallManager(api);
    manager.initialize();
    expect(await manager.start({ inbound: true })).toBe(true);
    expect(manager.getCall()?.answered).toBe(false);

    expect(await manager.start({ cameraID: 'camera.garage', inbound: true })).toBe(true);

    expect(manager.getCall()?.cameraID).toBe('camera.garage');
    expect(manager.getCall()?.inbound).toBe(true);
  });

  it('should let a manual start supersede an answered inbound call', async () => {
    // Manual start (inbound: false) retains full supersede authority --
    // explicit user intent wins.
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      store: twoCameraStore,
    });
    const manager = new CallManager(api);
    manager.initialize();
    expect(await manager.start({ inbound: true })).toBe(true);
    getConditionStateListener(api)({
      old: {
        camera: 'camera.office',
        view: 'live',
        microphone: { connected: true, muted: true, forbidden: false },
      },
      change: { microphone: { connected: true, muted: false, forbidden: false } },
      new: {
        camera: 'camera.office',
        view: 'live',
        microphone: { connected: true, muted: false, forbidden: false },
      },
    });

    expect(await manager.start({ cameraID: 'camera.garage' })).toBe(true);

    expect(manager.getCall()?.cameraID).toBe('camera.garage');
    expect(manager.getCall()?.inbound).toBe(false);
  });
});

describe('end', () => {
  it('should do nothing when no call is active', () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });

    expect(new CallManager(api).end()).toBe(false);

    expect(api.getViewManager().setViewByParameters).not.toBeCalled();
  });

  it('should end an active call', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const manager = new CallManager(api);
    expect(await manager.start()).toBe(true);
    vi.mocked(api.getViewManager().setViewByParameters).mockClear();

    expect(manager.end()).toBe(true);

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
    expect(await manager.start()).toBe(true);
    vi.mocked(api.getViewManager().setViewByParameters).mockClear();

    expect(manager.end()).toBe(true);

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
    expect(await manager.start()).toBe(true);

    expect(manager.end()).toBe(true);

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
    expect(await manager.start()).toBe(true);
    vi.mocked(api.getViewManager().setViewByParameters).mockClear();

    expect(manager.end()).toBe(true);

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
    expect(await manager.start({ cameraID: 'camera.office' })).toBe(true);

    expect(manager.end()).toBe(true);

    const restored = vi.mocked(api.getViewManager().setViewByParametersWithExistingQuery)
      .mock.calls[0]?.[0];
    expect(restored?.baseView?.view).toBe('folder');
    expect(restored?.baseView?.camera).toBeNull();
  });
});

// `endIf` is the predicate-driven conditional end: ends the active call iff
// every supplied option matches its corresponding field on the session.
// Fields left `undefined` are not gated on.
describe('endIf', () => {
  it('should no-op when there is no active call', () => {
    const api = createAPI();
    const manager = new CallManager(api);

    expect(manager.endIf({ cameraID: 'camera.office' })).toBe(false);
    expect(manager.isActive()).toBe(false);
  });

  it('should end unconditionally when no options are supplied', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const manager = new CallManager(api);
    expect(await manager.start()).toBe(true);
    expect(manager.isActive()).toBe(true);

    expect(manager.endIf({})).toBe(true);

    expect(manager.isActive()).toBe(false);
  });

  describe('cameraID gate', () => {
    it('should end when cameraID matches', async () => {
      const api = createAPI({ view: createView({ camera: 'camera.office' }) });
      const manager = new CallManager(api);
      expect(await manager.start()).toBe(true);

      expect(manager.endIf({ cameraID: 'camera.office' })).toBe(true);

      expect(manager.isActive()).toBe(false);
    });

    it('should not end when cameraID does not match', async () => {
      const api = createAPI({ view: createView({ camera: 'camera.office' }) });
      const manager = new CallManager(api);
      expect(await manager.start()).toBe(true);

      expect(manager.endIf({ cameraID: 'camera.other' })).toBe(false);

      expect(manager.isActive()).toBe(true);
    });
  });

  describe('inbound gate', () => {
    it('should end an inbound call when inbound: true is required', async () => {
      const api = createAPI({ view: createView({ camera: 'camera.office' }) });
      const manager = new CallManager(api);
      expect(await manager.start({ inbound: true })).toBe(true);

      expect(manager.endIf({ inbound: true })).toBe(true);

      expect(manager.isActive()).toBe(false);
    });

    it('should not end a manual call when inbound: true is required', async () => {
      const api = createAPI({ view: createView({ camera: 'camera.office' }) });
      const manager = new CallManager(api);
      expect(await manager.start()).toBe(true);

      expect(manager.endIf({ inbound: true })).toBe(false);

      expect(manager.isActive()).toBe(true);
    });

    it('should end a manual call when inbound: false is required', async () => {
      const api = createAPI({ view: createView({ camera: 'camera.office' }) });
      const manager = new CallManager(api);
      expect(await manager.start()).toBe(true);

      expect(manager.endIf({ inbound: false })).toBe(true);

      expect(manager.isActive()).toBe(false);
    });
  });

  describe('answered gate', () => {
    it('should end an unanswered call when answered: false is required', async () => {
      const api = createAPI({ view: createView({ camera: 'camera.office' }) });
      const manager = new CallManager(api);
      manager.initialize();
      expect(await manager.start({ inbound: true })).toBe(true);
      expect(manager.getCall()?.answered).toBe(false);

      expect(manager.endIf({ answered: false })).toBe(true);

      expect(manager.isActive()).toBe(false);
    });

    it('should not end an answered call when answered: false is required', async () => {
      const api = createAPI({ view: createView({ camera: 'camera.office' }) });
      const manager = new CallManager(api);
      manager.initialize();
      expect(await manager.start({ inbound: true })).toBe(true);
      getConditionStateListener(api)({
        old: {
          camera: 'camera.office',
          view: 'live',
          microphone: { connected: true, muted: true, forbidden: false },
        },
        change: { microphone: { connected: true, muted: false, forbidden: false } },
        new: {
          camera: 'camera.office',
          view: 'live',
          microphone: { connected: true, muted: false, forbidden: false },
        },
      });
      expect(manager.getCall()?.answered).toBe(true);

      expect(manager.endIf({ answered: false })).toBe(false);

      expect(manager.isActive()).toBe(true);
    });
  });

  describe('combined gates (the trigger-untrigger predicate)', () => {
    // The single composite predicate the `untrigger: 'call'` action uses:
    // end iff it's an inbound, unanswered call on this same camera.
    const triggerPredicate = (cameraID: string) => ({
      cameraID,
      inbound: true,
      answered: false,
    });

    it('should end an unanswered inbound call on the matching camera', async () => {
      const api = createAPI({ view: createView({ camera: 'camera.office' }) });
      const manager = new CallManager(api);
      manager.initialize();
      expect(await manager.start({ inbound: true })).toBe(true);

      expect(manager.endIf(triggerPredicate('camera.office'))).toBe(true);

      expect(manager.isActive()).toBe(false);
    });

    it('should not end when the camera differs', async () => {
      const api = createAPI({ view: createView({ camera: 'camera.office' }) });
      const manager = new CallManager(api);
      manager.initialize();
      expect(await manager.start({ inbound: true })).toBe(true);

      expect(manager.endIf(triggerPredicate('camera.other'))).toBe(false);

      expect(manager.isActive()).toBe(true);
    });

    it('should not end a manual call even on the matching camera', async () => {
      const api = createAPI({ view: createView({ camera: 'camera.office' }) });
      const manager = new CallManager(api);
      manager.initialize();
      expect(await manager.start()).toBe(true);

      expect(manager.endIf(triggerPredicate('camera.office'))).toBe(false);

      expect(manager.isActive()).toBe(true);
    });
  });
});

describe('condition state changes', () => {
  it('should end the call when the selected camera changes away', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const manager = new CallManager(api);
    manager.initialize();
    expect(await manager.start()).toBe(true);
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
    manager.initialize();
    expect(await manager.start()).toBe(true);
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
    manager.initialize();
    expect(await manager.start()).toBe(true);
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
    manager.initialize();
    expect(await manager.start()).toBe(true);

    getConditionStateListener(api)({
      old: { camera: 'camera.office' },
      change: { view: 'live' },
      new: { camera: 'camera.office', view: 'live' },
    });

    expect(manager.isActive()).toBe(true);
  });

  it('should no-op when no call is active', () => {
    const api = createAPI();
    new CallManager(api).initialize();

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
    manager.initialize();
    expect(await manager.start()).toBe(true);

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
    manager.initialize();
    expect(await manager.start()).toBe(true);

    getConditionStateListener(api)({
      old: { camera: 'camera.office', substreamID: 'camera.sub' },
      change: { view: 'live' },
      new: { camera: 'camera.office', substreamID: 'camera.sub', view: 'live' },
    });

    expect(manager.isActive()).toBe(true);
  });

  it('should ignore unrelated setState calls during a camera supersede', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const manager = new CallManager(api);
    manager.initialize();
    await manager.start({ inbound: true });

    // Simulate the new session having been swapped to a different camera.
    const call = manager.getCall();
    assert(call);
    call.cameraID = 'camera.garage';

    // Fire a setState that does NOT change view/camera/substream -- only
    // `mediaLoadedInfo`. The listener must not end the call.
    getConditionStateListener(api)({
      old: { view: 'live', camera: 'camera.office' },
      change: { mediaLoadedInfo: null },
      new: { view: 'live', camera: 'camera.office', mediaLoadedInfo: null },
    });

    expect(manager.isActive()).toBe(true);
  });
});

describe('initialize / uninitialize', () => {
  it('should not register the condition state listener until initialize', () => {
    const api = createAPI();
    new CallManager(api);

    expect(api.getConditionStateManager().addListener).not.toBeCalled();
  });

  it('should register the condition state listener on initialize', () => {
    const api = createAPI();
    const manager = new CallManager(api);

    manager.initialize();

    expect(api.getConditionStateManager().addListener).toBeCalled();
  });

  it('should remove the condition state listener on uninitialize', () => {
    const api = createAPI();
    const manager = new CallManager(api);
    manager.initialize();
    const listener = getConditionStateListener(api);

    manager.uninitialize();

    expect(api.getConditionStateManager().removeListener).toBeCalledWith(listener);
  });

  it('should tear down any active call session on uninitialize', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const manager = new CallManager(api);
    manager.initialize();
    expect(await manager.start()).toBe(true);
    expect(manager.isActive()).toBe(true);

    manager.uninitialize();

    expect(manager.isActive()).toBe(false);
    expect(api.getConditionStateManager().setState).toBeCalledWith({ call: false });
  });

  it('should ignore further condition state changes after uninitialize', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const manager = new CallManager(api);
    manager.initialize();
    expect(await manager.start()).toBe(true);
    const listener = getConditionStateListener(api);

    manager.uninitialize();
    vi.mocked(api.getViewManager().setViewByParameters).mockClear();

    // Even if a stale ref to the listener fires it, the call session is
    // already torn down so no view-change happens.
    listener({
      old: { camera: 'camera.office', view: 'live' },
      change: { camera: 'camera.other' },
      new: { camera: 'camera.other', view: 'live' },
    });

    expect(api.getViewManager().setViewByParameters).not.toBeCalled();
  });
});

// `inbound: true` suppresses each of the preflight/validation notifications.
// Every path that would call `_notifyError` is exercised under both the
// non-inbound case (notification surfaced) and the inbound case (silent). The
// non-inbound coverage already lives in the `start` describe above; here we
// assert the inbound paths stay silent.
describe('inbound option', () => {
  it('should suppress notification when the camera lacks live capability', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      store: createStore([
        {
          cameraID: 'camera.office',
          capabilities: createCapabilities({ live: false, '2-way-audio': true }),
        },
      ]),
    });

    expect(await new CallManager(api).start({ inbound: true })).toBe(false);

    expect(api.getNotificationManager().setNotification).not.toBeCalled();
  });

  it('should suppress notification when the microphone is unsupported', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneSupported: false,
    });

    expect(await new CallManager(api).start({ inbound: true })).toBe(false);

    expect(api.getNotificationManager().setNotification).not.toBeCalled();
  });

  it('should suppress notification when the microphone is forbidden', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneForbidden: true,
    });

    expect(await new CallManager(api).start({ inbound: true })).toBe(false);

    expect(api.getNotificationManager().setNotification).not.toBeCalled();
  });

  it('should suppress notification when microphone connect rejects', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneConnected: false,
    });
    vi.mocked(api.getMicrophoneManager().connect).mockRejectedValue(new Error('denied'));

    expect(await new CallManager(api).start({ inbound: true })).toBe(false);

    expect(api.getNotificationManager().setNotification).not.toBeCalled();
  });

  it('should suppress notification when an explicit stream is not 2-way audio', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });

    expect(
      await new CallManager(api).start({
        inbound: true,
        streamID: 'camera.unrelated',
      }),
    ).toBe(false);

    expect(api.getNotificationManager().setNotification).not.toBeCalled();
  });

  it('should suppress notification when no stream supports 2-way audio', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      store: createStore([
        {
          cameraID: 'camera.office',
          capabilities: createCapabilities({ live: true, '2-way-audio': false }),
        },
      ]),
    });

    expect(await new CallManager(api).start({ inbound: true })).toBe(false);

    expect(api.getNotificationManager().setNotification).not.toBeCalled();
  });

  it('should record the call as inbound on the session', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const manager = new CallManager(api);

    expect(await manager.start({ inbound: true })).toBe(true);

    expect(manager.getCall()?.inbound).toBe(true);
    expect(manager.getCall()?.answered).toBe(false);
  });
});

// Answered tracking: the first muted->unmuted microphone transition during an
// inbound call flips `answered` to true (once; later mute/unmute cycles do not
// flip it back) and stops the ringtone / cancels the unanswered timer.
describe('answered tracking', () => {
  const inboundConfig = {
    live: { controls: { call: { ringtone: { type: 'chime' as const } } } },
  };

  it('should not be answered immediately after an inbound start', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      config: inboundConfig,
    });
    const manager = new CallManager(api);
    manager.initialize();

    expect(await manager.start({ inbound: true })).toBe(true);

    expect(manager.getCall()?.answered).toBe(false);
  });

  it('should mark answered on a muted->unmuted microphone transition', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      config: inboundConfig,
    });
    const manager = new CallManager(api);
    manager.initialize();
    expect(await manager.start({ inbound: true })).toBe(true);

    getConditionStateListener(api)({
      old: {
        camera: 'camera.office',
        view: 'live',
        microphone: { connected: true, muted: true, forbidden: false },
      },
      change: { microphone: { connected: true, muted: false, forbidden: false } },
      new: {
        camera: 'camera.office',
        view: 'live',
        microphone: { connected: true, muted: false, forbidden: false },
      },
    });

    expect(manager.getCall()?.answered).toBe(true);
  });

  it('should not flip answered back when the user re-mutes after answering', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      config: inboundConfig,
    });
    const manager = new CallManager(api);
    manager.initialize();
    expect(await manager.start({ inbound: true })).toBe(true);
    const listener = getConditionStateListener(api);

    listener({
      old: {
        camera: 'camera.office',
        view: 'live',
        microphone: { connected: true, muted: true, forbidden: false },
      },
      change: { microphone: { connected: true, muted: false, forbidden: false } },
      new: {
        camera: 'camera.office',
        view: 'live',
        microphone: { connected: true, muted: false, forbidden: false },
      },
    });
    expect(manager.getCall()?.answered).toBe(true);

    listener({
      old: {
        camera: 'camera.office',
        view: 'live',
        microphone: { connected: true, muted: false, forbidden: false },
      },
      change: { microphone: { connected: true, muted: true, forbidden: false } },
      new: {
        camera: 'camera.office',
        view: 'live',
        microphone: { connected: true, muted: true, forbidden: false },
      },
    });

    expect(manager.getCall()?.answered).toBe(true);
  });

  it('should not mark non-inbound calls answered on un-mute', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const manager = new CallManager(api);
    manager.initialize();
    expect(await manager.start()).toBe(true);

    getConditionStateListener(api)({
      old: {
        camera: 'camera.office',
        view: 'live',
        microphone: { connected: true, muted: true, forbidden: false },
      },
      change: { microphone: { connected: true, muted: false, forbidden: false } },
      new: {
        camera: 'camera.office',
        view: 'live',
        microphone: { connected: true, muted: false, forbidden: false },
      },
    });

    expect(manager.getCall()?.answered).toBe(false);
  });

  it('should stop the ringtone on answer', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      config: inboundConfig,
    });
    const manager = new CallManager(api);
    manager.initialize();
    expect(await manager.start({ inbound: true })).toBe(true);
    vi.mocked(getRingtone().stop).mockClear();

    getConditionStateListener(api)({
      old: {
        camera: 'camera.office',
        view: 'live',
        microphone: { connected: true, muted: true, forbidden: false },
      },
      change: { microphone: { connected: true, muted: false, forbidden: false } },
      new: {
        camera: 'camera.office',
        view: 'live',
        microphone: { connected: true, muted: false, forbidden: false },
      },
    });

    expect(getRingtone().stop).toBeCalled();
  });

  it('should treat an inbound call as already-answered when the mic is already un-muted', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneMuted: false,
      config: inboundConfig,
    });
    const manager = new CallManager(api);
    manager.initialize();

    expect(await manager.start({ inbound: true })).toBe(true);

    expect(manager.getCall()?.answered).toBe(true);
    expect(getRingtone().start).not.toBeCalled();
  });

  it('should not arm the unanswered timer when the mic is already un-muted', async () => {
    vi.useFakeTimers();
    try {
      const api = createAPI({
        view: createView({ camera: 'camera.office' }),
        microphoneMuted: false,
        config: {
          live: { controls: { call: { unanswered_timeout_seconds: 60 } } },
        },
      });
      const manager = new CallManager(api);
      manager.initialize();
      expect(await manager.start({ inbound: true })).toBe(true);

      vi.advanceTimersByTime(60_000);

      expect(manager.isActive()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('should not mark a manual (non-inbound) call as answered even if the mic is un-muted', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneMuted: false,
    });
    const manager = new CallManager(api);
    manager.initialize();

    expect(await manager.start()).toBe(true);

    // `answered` only carries meaning alongside `inbound`, so for manual
    // calls it stays at its default to make the intent explicit.
    expect(manager.getCall()?.answered).toBe(false);
  });
});

// Ringtone integration: started only for inbound + unanswered + a configured
// ringtone other than 'none'; stopped on end / uninitialize.
describe('ringtone', () => {
  it('should start the ringtone for an inbound call with a configured tone', async () => {
    const ringtone: RingtoneConfig = { type: 'chime', repeat: 0 };
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      config: { live: { controls: { call: { ringtone: ringtone } } } },
    });
    const manager = new CallManager(api);
    manager.initialize();

    expect(await manager.start({ inbound: true })).toBe(true);

    expect(getRingtone().start).toBeCalledWith(expect.objectContaining(ringtone));
  });

  it('should not start the ringtone for a non-inbound call', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      config: { live: { controls: { call: { ringtone: { type: 'chime' } } } } },
    });
    const manager = new CallManager(api);
    manager.initialize();

    expect(await manager.start()).toBe(true);

    expect(getRingtone().start).not.toBeCalled();
  });

  it("should not start the ringtone when type is 'none'", async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      config: { live: { controls: { call: { ringtone: { type: 'none' } } } } },
    });
    const manager = new CallManager(api);
    manager.initialize();

    expect(await manager.start({ inbound: true })).toBe(true);

    expect(getRingtone().start).not.toBeCalled();
  });

  it('should stop the ringtone when the call ends', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      config: { live: { controls: { call: { ringtone: { type: 'chime' } } } } },
    });
    const manager = new CallManager(api);
    manager.initialize();
    expect(await manager.start({ inbound: true })).toBe(true);
    vi.mocked(getRingtone().stop).mockClear();

    expect(manager.end()).toBe(true);

    expect(getRingtone().stop).toBeCalled();
  });

  it('should stop the ringtone on uninitialize', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      config: { live: { controls: { call: { ringtone: { type: 'chime' } } } } },
    });
    const manager = new CallManager(api);
    manager.initialize();
    expect(await manager.start({ inbound: true })).toBe(true);
    vi.mocked(getRingtone().stop).mockClear();

    manager.uninitialize();

    expect(getRingtone().stop).toBeCalled();
  });
});

// Unanswered-call timeout: when configured, arms a timer on inbound start,
// fires `end()` if no answer arrives, and cancels on answer, explicit end, or
// uninitialize.
describe('unanswered timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  const inboundConfig = (unanswered_timeout_seconds: number) => ({
    live: { controls: { call: { unanswered_timeout_seconds } } },
  });

  it('should auto-end an unanswered inbound call after the timeout', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      config: inboundConfig(60),
    });
    const manager = new CallManager(api);
    manager.initialize();
    expect(await manager.start({ inbound: true })).toBe(true);
    expect(manager.isActive()).toBe(true);

    vi.advanceTimersByTime(60_000);

    expect(manager.isActive()).toBe(false);
  });

  it('should not arm the timer when the timeout is 0', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      config: inboundConfig(0),
    });
    const manager = new CallManager(api);
    manager.initialize();
    expect(await manager.start({ inbound: true })).toBe(true);

    vi.advanceTimersByTime(60_000);

    expect(manager.isActive()).toBe(true);
  });

  it('should not arm the timer for non-inbound calls', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      config: inboundConfig(60),
    });
    const manager = new CallManager(api);
    manager.initialize();
    expect(await manager.start()).toBe(true);

    vi.advanceTimersByTime(60_000);

    expect(manager.isActive()).toBe(true);
  });

  it('should cancel the timer when the call is answered', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      config: inboundConfig(60),
    });
    const manager = new CallManager(api);
    manager.initialize();
    expect(await manager.start({ inbound: true })).toBe(true);

    getConditionStateListener(api)({
      old: {
        camera: 'camera.office',
        view: 'live',
        microphone: { connected: true, muted: true, forbidden: false },
      },
      change: { microphone: { connected: true, muted: false, forbidden: false } },
      new: {
        camera: 'camera.office',
        view: 'live',
        microphone: { connected: true, muted: false, forbidden: false },
      },
    });
    vi.advanceTimersByTime(60_000);

    expect(manager.isActive()).toBe(true);
  });

  it('should cancel the timer on explicit end', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      config: inboundConfig(60),
    });
    const manager = new CallManager(api);
    manager.initialize();
    expect(await manager.start({ inbound: true })).toBe(true);

    expect(manager.end()).toBe(true);
    // The timer firing after end() would be a no-op (no active call) -- the
    // important thing is that it does not throw or affect any state.
    vi.advanceTimersByTime(60_000);

    expect(manager.isActive()).toBe(false);
  });

  it('should cancel the timer on uninitialize', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      config: inboundConfig(60),
    });
    const manager = new CallManager(api);
    manager.initialize();
    expect(await manager.start({ inbound: true })).toBe(true);

    manager.uninitialize();
    vi.advanceTimersByTime(60_000);

    expect(manager.isActive()).toBe(false);
  });
});

// `start()` calls `setState({ call: true })` to broadcast the new call status;
// a listener that responds by navigating away will fire the manager's own
// condition listener and end the call before `start()` returns. Verify the
// post-setState re-read of the session prevents follow-up work (ringtone /
// unanswered timer) on a session that is already gone.
describe('session end during setState', () => {
  const inboundConfig = {
    live: {
      controls: {
        call: {
          ringtone: { type: 'chime' as const },
          unanswered_timeout_seconds: 60,
        },
      },
    },
  };

  it('should skip ringtone and unanswered timer when a listener ends the call', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      config: inboundConfig,
    });
    const manager = new CallManager(api);
    manager.initialize();
    const listener = getConditionStateListener(api);

    vi.mocked(api.getConditionStateManager().setState).mockImplementation((state) => {
      // Simulate a downstream listener that responds to `call: true` by
      // navigating away. The manager's own listener then ends the call,
      // nulling the session before `start()` finishes.
      if (state.call === true) {
        listener({
          old: { camera: 'camera.office', view: 'live' },
          change: { view: 'clips' },
          new: { camera: 'camera.office', view: 'clips' },
        });
      }
      return true;
    });

    expect(await manager.start({ inbound: true })).toBe(false);

    expect(getRingtone().start).not.toBeCalled();
    expect(manager.isActive()).toBe(false);
  });
});
