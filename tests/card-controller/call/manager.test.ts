// @vitest-environment jsdom

import type { PartialDeep } from 'type-fest';
import { assert, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { CameraManagerStore } from '../../../src/camera-manager/store';
import { CallManager } from '../../../src/card-controller/call/manager';
import { Ringtone } from '../../../src/card-controller/call/ringtone';
import type { CardController } from '../../../src/card-controller/controller';
import { SubstreamViewModifier } from '../../../src/card-controller/view/modifiers/substream';
import { createBackchannel } from '../../../src/components-lib/live/backchannel/factory';
import {
  BackchannelError,
  type Backchannel,
} from '../../../src/components-lib/live/backchannel/types';
import { ConditionStateManager } from '../../../src/condition-trigger/conditions/state-manager';
import type { ConditionStateChange } from '../../../src/condition-trigger/conditions/types';
import { CallTrigger } from '../../../src/condition-trigger/triggers/triggers/call';
import type { TriggerOfType } from '../../../src/condition-trigger/triggers/triggers/types';
import type { RingtoneConfig } from '../../../src/config/schema/live';
import type { AdvancedCameraCardConfig } from '../../../src/config/schema/types';
import { View } from '../../../src/view/view';
import {
  createCameraManager,
  createCapabilities,
  createStore,
} from '../../camera-manager/test-utils';
import { createTriggerEvaluatorContext } from '../../condition-trigger/triggers/triggers/test-utils';
import { createCameraConfig, createConfig } from '../../config/test-utils';
import { createCardAPI, createHASS } from '../../test-utils';
import { createView } from '../../view/test-utils';

// Replace Ringtone with a fresh `mock<Ringtone>()` per construction so each
// CallManager gets an isolated, type-safe ringtone we can assert on. The
// real Ringtone creates an AudioContext, which we never want in tests. The
// implementation must be callable with `new`, so it cannot be an arrow
// function.
vi.mock('../../../src/card-controller/call/ringtone', () => ({
  Ringtone: vi.fn().mockImplementation(function () {
    return mock<Ringtone>();
  }),
}));

vi.mock('../../../src/components-lib/live/backchannel/factory');

const getBackchannel = (): Backchannel => {
  const results = vi.mocked(createBackchannel).mock.results;
  const last = results.at(-1);
  assert(last);
  return last.value;
};

beforeEach(() => {
  vi.mocked(createBackchannel).mockReset();
  vi.mocked(createBackchannel).mockImplementation(() => mock<Backchannel>());
});

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
  vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
  vi.mocked(api.getMicrophoneManager().getStream).mockReturnValue(mock<MediaStream>());
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
    // absent. Outbound calls are answered by construction.
    expect(manager.getCall()).toEqual({
      cameraID: 'camera.office',
      previousView: expect.any(View),
      inbound: false,
      answered: true,
    });
    expect(manager.getCall()?.previousView?.view).toBe('live');
  });
});

describe('start', () => {
  it('should do nothing without a view camera', async () => {
    const api = createAPI({ view: createView({ camera: null }) });

    expect(await new CallManager(api).start()).toBe(false);

    expect(api.getViewManager().setViewByParameters).not.toHaveBeenCalled();
  });

  it('should do nothing when already active for the camera', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const manager = new CallManager(api);

    expect(await manager.start()).toBe(true);
    vi.mocked(api.getViewManager().setViewByParameters).mockClear();
    expect(await manager.start()).toBe(true);

    expect(api.getViewManager().setViewByParameters).not.toHaveBeenCalled();
  });

  it('should start a call on the selected camera', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });

    expect(await new CallManager(api).start()).toBe(true);

    expect(api.getViewManager().setViewByParameters).toHaveBeenCalledWith({
      modifiers: [expect.any(SubstreamViewModifier)],
      force: true,
    });
  });

  it('should navigate to the live view when started from elsewhere', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office', view: 'clips' }),
    });

    expect(await new CallManager(api).start()).toBe(true);

    expect(api.getViewManager().setViewByParameters).toHaveBeenCalledWith({
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

    expect(api.getViewManager().setViewByParameters).toHaveBeenCalledWith({
      modifiers: [expect.any(SubstreamViewModifier)],
      force: true,
    });
    expect(api.getViewManager().setViewByParameters).not.toHaveBeenCalledWith(
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
    expect(api.getViewManager().setViewByParameters).toHaveBeenCalledWith({
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
    expect(api.getViewManager().setViewByParameters).toHaveBeenCalledWith({
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

    expect(api.getViewManager().setViewByParameters).not.toHaveBeenCalled();
    expect(api.getNotificationManager().setNotification).toHaveBeenCalled();
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

    expect(api.getViewManager().setViewByParameters).not.toHaveBeenCalled();
    expect(api.getNotificationManager().setNotification).toHaveBeenCalled();
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

    expect(api.getViewManager().setViewByParameters).not.toHaveBeenCalled();
    expect(api.getNotificationManager().setNotification).toHaveBeenCalled();
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

    expect(api.getViewManager().setViewByParameters).toHaveBeenCalledWith({
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

    expect(api.getViewManager().setViewByParameters).toHaveBeenCalledWith({
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

    expect(api.getViewManager().setViewByParameters).not.toHaveBeenCalled();
    expect(api.getNotificationManager().setNotification).toHaveBeenCalled();
  });

  it('should abort when the microphone is forbidden', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneForbidden: true,
    });

    expect(await new CallManager(api).start()).toBe(false);

    expect(api.getViewManager().setViewByParameters).not.toHaveBeenCalled();
    expect(api.getNotificationManager().setNotification).toHaveBeenCalled();
  });

  it('should connect the microphone when not already connected', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneConnected: false,
    });
    vi.mocked(api.getMicrophoneManager().connect).mockResolvedValue(true);

    expect(await new CallManager(api).start()).toBe(true);

    expect(api.getMicrophoneManager().connect).toHaveBeenCalled();
    expect(api.getViewManager().setViewByParameters).toHaveBeenCalled();
  });

  it('should abort when connecting the microphone fails', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneConnected: false,
    });
    vi.mocked(api.getMicrophoneManager().connect).mockRejectedValue(new Error());

    expect(await new CallManager(api).start()).toBe(false);

    expect(api.getViewManager().setViewByParameters).not.toHaveBeenCalled();
    expect(api.getNotificationManager().setNotification).toHaveBeenCalled();
  });

  it('should ring an inbound call without connecting the microphone', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneConnected: false,
      config: { live: { controls: { call: { ringtone: { type: 'chime' } } } } },
    });
    vi.mocked(api.getMicrophoneManager().connect).mockRejectedValue(new Error());
    const manager = new CallManager(api);

    // The microphone is only needed once the call is answered, so a connect
    // that would fail must not stop the call from ringing.
    expect(await manager.start({ inbound: true })).toBe(true);

    expect(api.getMicrophoneManager().connect).not.toHaveBeenCalled();
    expect(getRingtone().start).toHaveBeenCalled();
  });

  it('should ring an inbound call when the microphone is forbidden', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneForbidden: true,
      config: { live: { controls: { call: { ringtone: { type: 'chime' } } } } },
    });
    const manager = new CallManager(api);

    // An earlier denial must not silence a doorbell: the ring needs no
    // microphone, and answering retries the connect.
    expect(await manager.start({ inbound: true })).toBe(true);

    expect(getRingtone().start).toHaveBeenCalled();
  });

  it('should abort an inbound call when the microphone is unsupported', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneSupported: false,
      config: { live: { controls: { call: { ringtone: { type: 'chime' } } } } },
    });
    const manager = new CallManager(api);

    // Unlike a denial, a browser without microphone support cannot start
    // supporting it while the page is loaded, so the call can never be taken.
    expect(await manager.start({ inbound: true })).toBe(false);

    expect(getRingtone().start).not.toHaveBeenCalled();
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

    expect(await manager.answer()).toBe(true);
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
    expect(await manager.answer()).toBe(true);

    expect(await manager.start({ cameraID: 'camera.garage' })).toBe(true);

    expect(manager.getCall()?.cameraID).toBe('camera.garage');
    expect(manager.getCall()?.inbound).toBe(false);
  });
});

describe('end', () => {
  it('should do nothing when no call is active', () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });

    expect(new CallManager(api).end()).toBe(false);

    expect(api.getViewManager().setViewByParameters).not.toHaveBeenCalled();
  });

  it('should end an active call', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const manager = new CallManager(api);
    expect(await manager.start()).toBe(true);
    vi.mocked(api.getViewManager().setViewByParameters).mockClear();

    expect(manager.end()).toBe(true);

    expect(manager.isActive()).toBe(false);
    expect(api.getViewManager().setViewByParameters).toHaveBeenCalledWith({
      modifiers: [expect.any(SubstreamViewModifier)],
      force: true,
    });
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
    expect(api.getViewManager().setViewByParameters).toHaveBeenCalledWith({
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

    expect(
      api.getViewManager().setViewByParametersWithExistingQuery,
    ).toHaveBeenCalledWith({
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
    expect(api.getViewManager().setViewByParameters).toHaveBeenCalledWith({
      modifiers: [expect.any(SubstreamViewModifier)],
      force: true,
    });
    expect(
      api.getViewManager().setViewByParametersWithExistingQuery,
    ).not.toHaveBeenCalled();
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
      expect(await manager.answer()).toBe(true);
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
    expect(api.getViewManager().setViewByParameters).toHaveBeenCalledWith({
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
    expect(
      api.getViewManager().setViewByParametersWithExistingQuery,
    ).not.toHaveBeenCalled();
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
    expect(api.getViewManager().setViewByParameters).toHaveBeenCalledWith({
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

    expect(api.getViewManager().setViewByParameters).not.toHaveBeenCalled();
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

    expect(api.getConditionStateManager().addListener).not.toHaveBeenCalled();
  });

  it('should register the condition state listener on initialize', () => {
    const api = createAPI();
    const manager = new CallManager(api);

    manager.initialize();

    expect(api.getConditionStateManager().addListener).toHaveBeenCalled();
  });

  it('should remove the condition state listener on uninitialize', () => {
    const api = createAPI();
    const manager = new CallManager(api);
    manager.initialize();
    const listener = getConditionStateListener(api);

    manager.uninitialize();

    expect(api.getConditionStateManager().removeListener).toHaveBeenCalledWith(listener);
  });

  it('should tear down any active call session on uninitialize', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const manager = new CallManager(api);
    manager.initialize();
    expect(await manager.start()).toBe(true);
    expect(manager.isActive()).toBe(true);

    manager.uninitialize();

    expect(manager.isActive()).toBe(false);
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

    expect(api.getViewManager().setViewByParameters).not.toHaveBeenCalled();
  });
});

// `inbound: true` suppresses each of the preflight/validation notifications an
// inbound start can still reach. The non-inbound coverage (notification
// surfaced) already lives in the `start` describe above; here we assert the
// inbound paths stay silent. The forbidden-microphone check is deliberately
// absent -- an inbound start no longer reaches it at all.
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

    expect(api.getNotificationManager().setNotification).not.toHaveBeenCalled();
  });

  it('should suppress notification when the microphone is unsupported', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneSupported: false,
    });

    expect(await new CallManager(api).start({ inbound: true })).toBe(false);

    expect(api.getNotificationManager().setNotification).not.toHaveBeenCalled();
  });

  it('should suppress notification when an explicit stream is not 2-way audio', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });

    expect(
      await new CallManager(api).start({
        inbound: true,
        streamID: 'camera.unrelated',
      }),
    ).toBe(false);

    expect(api.getNotificationManager().setNotification).not.toHaveBeenCalled();
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

    expect(api.getNotificationManager().setNotification).not.toHaveBeenCalled();
  });

  it('should record the call as inbound on the session', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const manager = new CallManager(api);

    expect(await manager.start({ inbound: true })).toBe(true);

    expect(manager.getCall()?.inbound).toBe(true);
    expect(manager.getCall()?.answered).toBe(false);
  });
});

describe('answer', () => {
  const inboundConfig = {
    live: { controls: { call: { ringtone: { type: 'chime' as const } } } },
  };

  it('should default to unanswered for an inbound start', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      config: inboundConfig,
    });
    const manager = new CallManager(api);
    manager.initialize();

    expect(await manager.start({ inbound: true })).toBe(true);

    expect(manager.getCall()?.answered).toBe(false);
  });

  it('should default to answered for an outbound start', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const manager = new CallManager(api);
    manager.initialize();

    expect(await manager.start()).toBe(true);

    // Outbound calls are answered by construction -- the user initiated them.
    expect(manager.getCall()?.answered).toBe(true);
  });

  it('should default to unanswered for inbound even if the mic is already un-muted', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneMuted: false,
      config: inboundConfig,
    });
    const manager = new CallManager(api);
    manager.initialize();

    expect(await manager.start({ inbound: true })).toBe(true);

    expect(manager.getCall()?.answered).toBe(false);
    expect(getRingtone().start).toHaveBeenCalled();
  });

  it('should no-op when no call is active', async () => {
    const api = createAPI();
    const manager = new CallManager(api);

    expect(await manager.answer()).toBe(false);
  });

  it('should no-op when the call is already answered', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      config: inboundConfig,
    });
    const manager = new CallManager(api);
    manager.initialize();
    expect(await manager.start({ inbound: true })).toBe(true);
    expect(await manager.answer()).toBe(true);
    vi.mocked(getRingtone().stop).mockClear();
    vi.mocked(api.getCardElementManager().update).mockClear();

    expect(await manager.answer()).toBe(false);

    expect(getRingtone().stop).not.toHaveBeenCalled();
    expect(api.getCardElementManager().update).not.toHaveBeenCalled();
  });

  it('should mark answered and replace the session immutably', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      config: inboundConfig,
    });
    const manager = new CallManager(api);
    manager.initialize();
    expect(await manager.start({ inbound: true })).toBe(true);
    const before = manager.getCall();

    expect(await manager.answer()).toBe(true);

    const after = manager.getCall();
    expect(after?.answered).toBe(true);
    // New object identity so Lit consumers re-render on the prop change.
    expect(after).not.toBe(before);
    expect(after?.cameraID).toBe(before?.cameraID);
    expect(after?.inbound).toBe(before?.inbound);
  });

  it('should stop the ringtone and unanswered timer on answer', async () => {
    vi.useFakeTimers();
    try {
      const api = createAPI({
        view: createView({ camera: 'camera.office' }),
        config: {
          live: {
            controls: {
              call: {
                ringtone: { type: 'chime' as const },
                unanswered_timeout_seconds: 60,
              },
            },
          },
        },
      });
      const manager = new CallManager(api);
      manager.initialize();
      expect(await manager.start({ inbound: true })).toBe(true);
      vi.mocked(getRingtone().stop).mockClear();

      expect(await manager.answer()).toBe(true);

      expect(getRingtone().stop).toHaveBeenCalled();

      // Timer was armed and should now be cancelled: advancing past the
      // timeout must not end the (now-answered) call.
      vi.advanceTimersByTime(60_000);
      expect(manager.isActive()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('should connect the microphone on answer', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneConnected: false,
      config: inboundConfig,
    });
    vi.mocked(api.getMicrophoneManager().connect).mockResolvedValue(true);
    const manager = new CallManager(api);
    manager.initialize();
    expect(await manager.start({ inbound: true })).toBe(true);

    expect(await manager.answer()).toBe(true);

    expect(api.getMicrophoneManager().connect).toHaveBeenCalled();
  });

  it('should silence the ringtone before the microphone connect', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneConnected: false,
      config: inboundConfig,
    });
    let resolveConnect: (connected: boolean) => void = () => {};
    vi.mocked(api.getMicrophoneManager().connect).mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveConnect = resolve;
      }),
    );
    const manager = new CallManager(api);
    manager.initialize();
    expect(await manager.start({ inbound: true })).toBe(true);
    vi.mocked(getRingtone().stop).mockClear();

    const answerPromise = manager.answer();

    // The user has acknowledged the ring, so it must stop without waiting for a
    // microphone permission prompt to be dealt with.
    expect(getRingtone().stop).toHaveBeenCalled();

    resolveConnect(true);
    expect(await answerPromise).toBe(true);
  });

  it('should leave the call ringing when the microphone connect fails', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneConnected: false,
      config: inboundConfig,
    });
    vi.mocked(api.getMicrophoneManager().connect).mockRejectedValue(new Error('denied'));
    const manager = new CallManager(api);
    manager.initialize();
    expect(await manager.start({ inbound: true })).toBe(true);

    expect(await manager.answer()).toBe(false);

    // Answering is an explicit user gesture, so the failure is surfaced and the
    // call remains answerable.
    expect(api.getNotificationManager().setNotification).toHaveBeenCalled();
    expect(manager.getCall()?.answered).toBe(false);
  });

  it('should force a card re-render on answer', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      config: inboundConfig,
    });
    const manager = new CallManager(api);
    manager.initialize();
    expect(await manager.start({ inbound: true })).toBe(true);
    vi.mocked(api.getCardElementManager().update).mockClear();

    expect(await manager.answer()).toBe(true);

    // The card subtree depends on `getCall().answered`, which the manager
    // mutates outside the view-manager epoch -- so `update()` is what drives
    // the re-render through to the call-controls overlay.
    expect(api.getCardElementManager().update).toHaveBeenCalled();
  });

  it('should not mark non-inbound (outbound) calls via answer (already answered)', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const manager = new CallManager(api);
    manager.initialize();
    expect(await manager.start()).toBe(true);

    // Outbound starts answered, so `answer()` is a no-op.
    expect(await manager.answer()).toBe(false);
    expect(manager.getCall()?.answered).toBe(true);
  });

  it('should not flip answered on mic mute/unmute transitions', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      config: inboundConfig,
    });
    const manager = new CallManager(api);
    manager.initialize();
    expect(await manager.start({ inbound: true })).toBe(true);
    const listener = getConditionStateListener(api);

    // Mic mute -> unmute during the pre-answer ring: must NOT auto-answer.
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

    expect(manager.getCall()?.answered).toBe(false);
  });
});

describe('microphone transmission', () => {
  it('should transmit for the duration of the call', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const manager = new CallManager(api);

    expect(await manager.start()).toBe(true);

    expect(api.getMicrophoneManager().setTransmissionActive).toHaveBeenCalledWith(true);
    expect(api.getMicrophoneManager().setTransmissionActive).not.toHaveBeenCalledWith(
      false,
    );

    manager.end();

    expect(api.getMicrophoneManager().setTransmissionActive).toHaveBeenLastCalledWith(
      false,
    );
  });

  it('should stop transmitting when the call fails to start', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneConnected: false,
    });
    vi.mocked(api.getMicrophoneManager().connect).mockRejectedValue(new Error());

    expect(await new CallManager(api).start()).toBe(false);

    // Transmission is granted ahead of the microphone connect, so the failed
    // start must withdraw it again.
    expect(api.getMicrophoneManager().setTransmissionActive).toHaveBeenNthCalledWith(
      1,
      true,
    );
    expect(api.getMicrophoneManager().setTransmissionActive).toHaveBeenLastCalledWith(
      false,
    );
  });

  it('should keep transmitting when one call replaces another', async () => {
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

    expect(api.getMicrophoneManager().setTransmissionActive).not.toHaveBeenCalledWith(
      false,
    );
  });

  it('should stop transmitting when uninitialized during a call', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const manager = new CallManager(api);

    expect(await manager.start()).toBe(true);
    manager.uninitialize();

    expect(api.getMicrophoneManager().setTransmissionActive).toHaveBeenLastCalledWith(
      false,
    );
  });

  it('should stop transmitting when uninitialized without a call', () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });

    new CallManager(api).uninitialize();

    expect(api.getMicrophoneManager().setTransmissionActive).toHaveBeenCalledWith(false);
  });

  it('should leave transmission alone when an unanswered inbound call ends', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const manager = new CallManager(api);
    manager.initialize();

    expect(await manager.start({ inbound: true })).toBe(true);
    expect(manager.end()).toBe(true);

    expect(api.getMicrophoneManager().setTransmissionActive).not.toHaveBeenCalled();
  });

  it('should stop transmitting when uninitialized while a call connects the microphone', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneConnected: false,
    });
    let resolveConnect: (connected: boolean) => void = () => {};
    vi.mocked(api.getMicrophoneManager().connect).mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveConnect = resolve;
      }),
    );
    const manager = new CallManager(api);
    manager.initialize();

    const startPromise = manager.start();
    manager.uninitialize();

    // The grant must not outlive the manager while the connect is still
    // pending.
    expect(api.getMicrophoneManager().setTransmissionActive).toHaveBeenLastCalledWith(
      false,
    );

    resolveConnect(true);
    expect(await startPromise).toBe(false);
  });

  it('should let a later call stop transmitting after an abandoned call is uninitialized', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneConnected: false,
    });
    let resolveConnect: (connected: boolean) => void = () => {};
    vi.mocked(api.getMicrophoneManager().connect).mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveConnect = resolve;
      }),
    );
    const manager = new CallManager(api);
    manager.initialize();

    // A start from the first lifecycle never gets its microphone.
    const stalledStart = manager.start();
    manager.uninitialize();
    manager.initialize();

    // A call in the new lifecycle must end normally: the stalled request from
    // the old lifecycle no longer holds transmission.
    vi.mocked(api.getMicrophoneManager().isConnected).mockReturnValue(true);
    expect(await manager.start()).toBe(true);
    expect(manager.end()).toBe(true);
    expect(api.getMicrophoneManager().setTransmissionActive).toHaveBeenLastCalledWith(
      false,
    );

    resolveConnect(true);
    expect(await stalledStart).toBe(false);
  });

  it('should transmit for a call that starts while another call is ending', async () => {
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
    manager.initialize();

    expect(await manager.start()).toBe(true);

    // The superseding start is suspended on the microphone while the answered
    // call ends and reports transmission inactive.
    const second = manager.start({ cameraID: 'camera.garage' });
    expect(manager.end()).toBe(true);
    expect(api.getMicrophoneManager().setTransmissionActive).toHaveBeenLastCalledWith(
      false,
    );

    expect(await second).toBe(true);

    // The installed session restated its need so the user can be heard on unmute.
    expect(manager.getCall()?.cameraID).toBe('camera.garage');
    expect(api.getMicrophoneManager().setTransmissionActive).toHaveBeenLastCalledWith(
      true,
    );
  });

  it('should not transmit for an inbound call that rings after another call ends', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const manager = new CallManager(api);
    manager.initialize();

    expect(await manager.start()).toBe(true);
    expect(manager.end()).toBe(true);
    expect(api.getMicrophoneManager().setTransmissionActive).toHaveBeenLastCalledWith(
      false,
    );

    expect(await manager.start({ inbound: true })).toBe(true);

    // A ring transmits nothing, so it must not restate a need for
    // transmission.
    expect(api.getMicrophoneManager().setTransmissionActive).toHaveBeenLastCalledWith(
      false,
    );
  });

  it('should stop transmitting when a call ends and the next cannot get the microphone', async () => {
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
    manager.initialize();

    expect(await manager.start()).toBe(true);

    vi.mocked(api.getMicrophoneManager().isConnected).mockReturnValue(false);
    let rejectConnect: (reason: unknown) => void = () => {};
    vi.mocked(api.getMicrophoneManager().connect).mockReturnValue(
      new Promise<boolean>((_, reject) => {
        rejectConnect = reject;
      }),
    );
    const second = manager.start({ cameraID: 'camera.garage' });

    expect(manager.end()).toBe(true);

    rejectConnect(new Error());
    expect(await second).toBe(false);

    expect(api.getMicrophoneManager().setTransmissionActive).toHaveBeenLastCalledWith(
      false,
    );
  });

  it('should abort a call when the microphone does not stay connected', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneConnected: false,
    });
    let resolveConnect: (connected: boolean) => void = () => {};
    vi.mocked(api.getMicrophoneManager().connect).mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveConnect = resolve;
      }),
    );
    const manager = new CallManager(api);
    manager.initialize();

    const start = manager.start();

    // The microphone manager releases a stream it connected while nothing was
    // transmitting, and reports that the microphone is not connected.
    resolveConnect(false);

    expect(await start).toBe(false);
    expect(manager.isActive()).toBe(false);
    expect(api.getMicrophoneManager().setTransmissionActive).toHaveBeenLastCalledWith(
      false,
    );
  });

  it('should not transmit while an inbound call rings', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const manager = new CallManager(api);
    manager.initialize();

    expect(await manager.start({ inbound: true })).toBe(true);

    expect(api.getMicrophoneManager().setTransmissionActive).not.toHaveBeenCalled();
  });

  it('should allow transmission before connecting the microphone on answer', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneConnected: false,
    });
    vi.mocked(api.getMicrophoneManager().connect).mockResolvedValue(true);
    const manager = new CallManager(api);
    manager.initialize();
    expect(await manager.start({ inbound: true })).toBe(true);

    expect(await manager.answer()).toBe(true);

    // If transmission is not yet active when a connect completes, the
    // microphone manager immediately releases the new stream -- so the answer
    // must activate transmission before it connects. The ringing start touches
    // neither method, so index 0 is each method's first and only invocation,
    // made by the answer.
    const transmitOrder = vi.mocked(api.getMicrophoneManager().setTransmissionActive)
      .mock.invocationCallOrder[0];
    const connectOrder = vi.mocked(api.getMicrophoneManager().connect).mock
      .invocationCallOrder[0];
    expect(transmitOrder).toBeLessThan(connectOrder);
    expect(api.getMicrophoneManager().setTransmissionActive).toHaveBeenLastCalledWith(
      true,
    );
  });

  it('should stop transmitting when the microphone connect fails on answer', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneConnected: false,
    });
    vi.mocked(api.getMicrophoneManager().connect).mockRejectedValue(new Error());
    const manager = new CallManager(api);
    manager.initialize();
    expect(await manager.start({ inbound: true })).toBe(true);

    expect(await manager.answer()).toBe(false);

    expect(api.getMicrophoneManager().setTransmissionActive).toHaveBeenLastCalledWith(
      false,
    );
    expect(manager.getCall()?.answered).toBe(false);
  });

  it('should keep transmitting when a failed start leaves an earlier call in progress', async () => {
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

    // The second start fails its microphone connect, but the first call is
    // still answered and holds the transmission grant.
    vi.mocked(api.getMicrophoneManager().isConnected).mockReturnValue(false);
    vi.mocked(api.getMicrophoneManager().connect).mockRejectedValue(new Error());

    expect(await manager.start({ cameraID: 'camera.garage' })).toBe(false);

    expect(api.getMicrophoneManager().setTransmissionActive).not.toHaveBeenCalledWith(
      false,
    );
    expect(manager.getCall()?.cameraID).toBe('camera.office');
  });

  it('should stop transmitting when the call ends while answering connects the microphone', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneConnected: false,
    });
    let resolveConnect: (connected: boolean) => void = () => {};
    vi.mocked(api.getMicrophoneManager().connect).mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveConnect = resolve;
      }),
    );
    const manager = new CallManager(api);
    manager.initialize();
    expect(await manager.start({ inbound: true })).toBe(true);

    const answerPromise = manager.answer();
    manager.end();
    resolveConnect(true);

    expect(await answerPromise).toBe(false);
    expect(api.getMicrophoneManager().setTransmissionActive).toHaveBeenLastCalledWith(
      false,
    );
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

    expect(getRingtone().start).toHaveBeenCalledWith(expect.objectContaining(ringtone));
  });

  it('should not start the ringtone for a non-inbound call', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      config: { live: { controls: { call: { ringtone: { type: 'chime' } } } } },
    });
    const manager = new CallManager(api);
    manager.initialize();

    expect(await manager.start()).toBe(true);

    expect(getRingtone().start).not.toHaveBeenCalled();
  });

  it("should not start the ringtone when type is 'none'", async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      config: { live: { controls: { call: { ringtone: { type: 'none' } } } } },
    });
    const manager = new CallManager(api);
    manager.initialize();

    expect(await manager.start({ inbound: true })).toBe(true);

    expect(getRingtone().start).not.toHaveBeenCalled();
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

    expect(getRingtone().stop).toHaveBeenCalled();
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

    expect(getRingtone().stop).toHaveBeenCalled();
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

    expect(await manager.answer()).toBe(true);
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

// `start()` calls `setState()` to broadcast the new call phase;
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
      // Simulate a downstream listener that responds to the inbound ring by
      // navigating away. The manager's own listener then ends the call,
      // nulling the session before `start()` finishes.
      if (state.call === 'ringing') {
        listener({
          old: { camera: 'camera.office', view: 'live' },
          change: { view: 'clips' },
          new: { camera: 'camera.office', view: 'clips' },
        });
      }
      return true;
    });

    expect(await manager.start({ inbound: true })).toBe(false);

    expect(getRingtone().start).not.toHaveBeenCalled();
    expect(manager.isActive()).toBe(false);
  });
});

describe('state changes during in-flight start', () => {
  it('should not install a session when uninitialized mid-await', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneConnected: false,
    });
    let resolveConnect: (connected: boolean) => void = () => {};
    vi.mocked(api.getMicrophoneManager().connect).mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveConnect = resolve;
      }),
    );
    const manager = new CallManager(api);
    manager.initialize();

    const startPromise = manager.start();
    manager.uninitialize();
    resolveConnect(true);

    expect(await startPromise).toBe(false);
    expect(manager.isActive()).toBe(false);
    expect(api.getViewManager().setViewByParameters).not.toHaveBeenCalled();
  });

  it('should not install a session when uninitialized and re-initialized mid-await', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneConnected: false,
    });
    let resolveConnect: (connected: boolean) => void = () => {};
    vi.mocked(api.getMicrophoneManager().connect).mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveConnect = resolve;
      }),
    );
    const manager = new CallManager(api);
    manager.initialize();

    const startPromise = manager.start();
    manager.uninitialize();
    manager.initialize();
    resolveConnect(true);

    expect(await startPromise).toBe(false);
    expect(manager.isActive()).toBe(false);
    expect(api.getViewManager().setViewByParameters).not.toHaveBeenCalled();
  });

  it('should supersede a session installed by another start mid-await', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneConnected: false,
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
    let resolveConnect: (connected: boolean) => void = () => {};
    vi.mocked(api.getMicrophoneManager().connect).mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveConnect = resolve;
      }),
    );
    const manager = new CallManager(api);
    manager.initialize();

    // Both requests read the (absent) session before either can install one.
    const first = manager.start();
    const second = manager.start({ cameraID: 'camera.garage' });
    resolveConnect(true);

    expect(await first).toBe(false);
    expect(await second).toBe(true);

    // The second request must end the first request's session rather than
    // overwrite it, leaving exactly one live session with transmission still
    // granted.
    expect(manager.getCall()?.cameraID).toBe('camera.garage');
    expect(api.getMicrophoneManager().setTransmissionActive).not.toHaveBeenCalledWith(
      false,
    );
  });

  it('should suppress the microphone-failure notification when uninitialized mid-await', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      microphoneConnected: false,
    });
    let rejectConnect: (reason: unknown) => void = () => {};
    vi.mocked(api.getMicrophoneManager().connect).mockReturnValue(
      new Promise<boolean>((_, reject) => {
        rejectConnect = reject;
      }),
    );
    const manager = new CallManager(api);
    manager.initialize();

    const startPromise = manager.start();
    manager.uninitialize();
    rejectConnect(new Error('denied'));

    expect(await startPromise).toBe(false);
    expect(api.getNotificationManager().setNotification).not.toHaveBeenCalled();
  });
});

// Answering an inbound call is where its microphone is connected, so the same
// mid-await state changes that `start()` guards against apply here too.
describe('state changes during in-flight answer', () => {
  const inboundConfig = {
    live: { controls: { call: { ringtone: { type: 'chime' as const } } } },
  };

  // Starts a ringing inbound call whose subsequent `answer()` will suspend on
  // the microphone connect until the returned settler is invoked.
  const createRingingCall = async (
    api: CardController,
  ): Promise<{
    manager: CallManager;
    resolveConnect: (connected: boolean) => void;
    rejectConnect: (reason: unknown) => void;
  }> => {
    const manager = new CallManager(api);
    manager.initialize();
    expect(await manager.start({ inbound: true })).toBe(true);

    vi.mocked(api.getMicrophoneManager().isConnected).mockReturnValue(false);
    let resolveConnect: (connected: boolean) => void = () => {};
    let rejectConnect: (reason: unknown) => void = () => {};
    vi.mocked(api.getMicrophoneManager().connect).mockReturnValue(
      new Promise<boolean>((resolve, reject) => {
        resolveConnect = resolve;
        rejectConnect = reject;
      }),
    );
    return { manager, resolveConnect, rejectConnect };
  };

  it('should not answer when uninitialized mid-await', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      config: inboundConfig,
    });
    const { manager, resolveConnect } = await createRingingCall(api);

    const answerPromise = manager.answer();
    manager.uninitialize();
    resolveConnect(true);

    expect(await answerPromise).toBe(false);
    expect(manager.isActive()).toBe(false);
  });

  it('should suppress the microphone-failure notification when uninitialized mid-await', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      config: inboundConfig,
    });
    const { manager, rejectConnect } = await createRingingCall(api);

    const answerPromise = manager.answer();
    manager.uninitialize();
    rejectConnect(new Error('denied'));

    expect(await answerPromise).toBe(false);
    expect(api.getNotificationManager().setNotification).not.toHaveBeenCalled();
  });

  it('should not answer a session that ended mid-await', async () => {
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      config: inboundConfig,
    });
    const { manager, resolveConnect } = await createRingingCall(api);

    const answerPromise = manager.answer();
    expect(manager.end()).toBe(true);
    resolveConnect(true);

    expect(await answerPromise).toBe(false);
    expect(manager.isActive()).toBe(false);
  });
});

// The phase the manager publishes is what automations actually react to, so
// these drive a real ConditionStateManager and a real CallTrigger and assert
// the transitions an automation would fire on, rather than that `setState` was
// called.
describe('the backchannel', () => {
  const startAnsweredCall = async (
    api: CardController,
  ): Promise<{ manager: CallManager; started: boolean }> => {
    const manager = new CallManager(api);
    manager.initialize();
    const started = await manager.start();
    return { manager, started };
  };

  it('should open the backchannel when an outbound call starts', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });

    const { started } = await startAnsweredCall(api);

    expect(started).toBe(true);
    expect(getBackchannel().start).toHaveBeenCalled();
  });

  it('should not open the backchannel while an inbound call is only ringing', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const manager = new CallManager(api);
    manager.initialize();

    await manager.start({ inbound: true });

    expect(createBackchannel).not.toHaveBeenCalled();
  });

  it('should open the backchannel when an inbound call is answered', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const manager = new CallManager(api);
    manager.initialize();
    await manager.start({ inbound: true });

    expect(await manager.answer()).toBe(true);
    expect(getBackchannel().start).toHaveBeenCalled();
  });

  it('should release the backchannel when the call ends', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const { manager } = await startAnsweredCall(api);
    const backchannel = getBackchannel();

    manager.end();

    expect(backchannel.stop).toHaveBeenCalled();
  });

  it('should release the backchannel when the manager is torn down', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const { manager } = await startAnsweredCall(api);
    const backchannel = getBackchannel();

    manager.uninitialize();

    expect(backchannel.stop).toHaveBeenCalled();
  });

  it('should end the call and report when the backchannel cannot be opened', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    vi.mocked(createBackchannel).mockImplementation(() => {
      const backchannel = mock<Backchannel>();
      backchannel.start.mockRejectedValue(new BackchannelError('no_two_way_audio'));
      return backchannel;
    });

    const { manager, started } = await startAnsweredCall(api);

    expect(started).toBe(false);
    expect(manager.getCall()).toBeNull();
    expect(api.getNotificationManager().setNotification).toHaveBeenCalled();
  });

  it('should not report a backchannel abandoned by this manager', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    vi.mocked(createBackchannel).mockImplementation(() => {
      const backchannel = mock<Backchannel>();
      backchannel.start.mockRejectedValue(new BackchannelError('abandoned'));
      return backchannel;
    });

    await startAnsweredCall(api);

    expect(api.getNotificationManager().setNotification).not.toHaveBeenCalled();
  });

  it('should release the previous backchannel before opening the next', async () => {
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
    const order: string[] = [];
    vi.mocked(createBackchannel).mockImplementation(() => {
      const backchannel = mock<Backchannel>();
      backchannel.start.mockImplementation(async () => void order.push('start'));
      backchannel.stop.mockImplementation(() => void order.push('stop'));
      return backchannel;
    });

    const manager = new CallManager(api);
    manager.initialize();
    await manager.start();
    await manager.start({ cameraID: 'camera.garage' });

    // A camera that permits a single backchannel must never see two at once.
    expect(order).toEqual(['start', 'stop', 'start']);
  });

  it('should end the call when the live provider has no backchannel to offer', async () => {
    // This is reachable through `capabilities.force` which can force 2-way
    // audio on a live provider that does not support it.
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    vi.mocked(createBackchannel).mockReturnValue(null);

    const { manager, started } = await startAnsweredCall(api);

    expect(started).toBe(false);
    expect(manager.getCall()).toBeNull();
    expect(api.getNotificationManager().setNotification).toHaveBeenCalled();
  });

  it('should still report a failure that has no reason', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    vi.mocked(createBackchannel).mockImplementation(() => {
      const backchannel = mock<Backchannel>();
      backchannel.start.mockRejectedValue(new Error('boom'));
      return backchannel;
    });

    await startAnsweredCall(api);

    expect(api.getNotificationManager().setNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { text: 'The camera could not be reached for two-way audio.' },
      }),
    );
  });

  it('should end the call when Home Assistant is not available', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(null);

    const { manager, started } = await startAnsweredCall(api);

    expect(started).toBe(false);
    expect(manager.getCall()).toBeNull();
  });

  it('should distinguish a microphone failure from an unreachable camera', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    vi.mocked(createBackchannel).mockImplementation(() => {
      const backchannel = mock<Backchannel>();
      backchannel.start.mockRejectedValue(new BackchannelError('no_microphone'));
      return backchannel;
    });

    await startAnsweredCall(api);

    expect(api.getNotificationManager().setNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { text: 'Your microphone could not be connected.' },
      }),
    );
  });

  it('should not report a backchannel that failed for a replaced call', async () => {
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

    let rejectFirst: (error: unknown) => void = () => {};
    let call = 0;
    vi.mocked(createBackchannel).mockImplementation(() => {
      const backchannel = mock<Backchannel>();
      if (call++ === 0) {
        backchannel.start.mockReturnValue(
          new Promise((_resolve, reject) => (rejectFirst = reject)),
        );
      }
      return backchannel;
    });

    const manager = new CallManager(api);
    manager.initialize();
    const first = manager.start();
    await manager.start({ cameraID: 'camera.garage' });

    rejectFirst(new BackchannelError('failed'));

    expect(await first).toBe(false);
    expect(api.getNotificationManager().setNotification).not.toHaveBeenCalled();
    expect(manager.getCall()?.cameraID).toBe('camera.garage');
  });

  it('should not report a backchannel lost after its call ended', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    const { manager } = await startAnsweredCall(api);
    const errorCallback = vi.mocked(createBackchannel).mock.calls[0][2];
    assert(errorCallback);

    manager.end();
    errorCallback(new BackchannelError('failed'));

    expect(api.getNotificationManager().setNotification).not.toHaveBeenCalled();
  });

  it('should report the backchannel being lost mid-call', async () => {
    const api = createAPI({ view: createView({ camera: 'camera.office' }) });
    await startAnsweredCall(api);

    const errorCallback = vi.mocked(createBackchannel).mock.calls[0][2];
    assert(errorCallback);
    errorCallback(new BackchannelError('failed', 'the sky fell'));

    expect(api.getNotificationManager().setNotification).toHaveBeenCalled();
  });
});

describe('published phase transitions in condition state', () => {
  const createAPIWithRealStateManager = (options?: {
    config?: PartialDeep<AdvancedCameraCardConfig>;
    store?: CameraManagerStore;
  }): { api: CardController; stateManager: ConditionStateManager } => {
    const stateManager = new ConditionStateManager();
    const api = createAPI({
      view: createView({ camera: 'camera.office' }),
      ...options,
    });
    vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);
    return { api, stateManager };
  };

  const watch = (
    stateManager: ConditionStateManager,
    trigger: TriggerOfType<'call'>,
  ): Mock => {
    const callback = vi.fn();
    new CallTrigger(trigger, createTriggerEvaluatorContext({ stateManager })).subscribe(
      callback,
    );
    return callback;
  };

  it('should fire a ringing trigger when an inbound call starts', async () => {
    const { api, stateManager } = createAPIWithRealStateManager();
    const manager = new CallManager(api);
    manager.initialize();

    const ringing = watch(stateManager, { trigger: 'call', to: 'ringing' });
    const answered = watch(stateManager, { trigger: 'call', to: 'answered' });

    expect(await manager.start({ inbound: true })).toBe(true);

    expect(ringing).toHaveBeenCalledTimes(1);
    expect(answered).not.toHaveBeenCalled();
  });

  it('should fire an answered trigger when an outbound call starts', async () => {
    const { api, stateManager } = createAPIWithRealStateManager();
    const manager = new CallManager(api);
    manager.initialize();

    const ringing = watch(stateManager, { trigger: 'call', to: 'ringing' });
    const answered = watch(stateManager, { trigger: 'call', to: 'answered' });

    // Outbound calls are answered by construction, so they never ring.
    expect(await manager.start()).toBe(true);

    expect(answered).toHaveBeenCalledTimes(1);
    expect(ringing).not.toHaveBeenCalled();
  });

  it('should fire an end trigger when an outbound call ends', async () => {
    const { api, stateManager } = createAPIWithRealStateManager();
    const manager = new CallManager(api);
    manager.initialize();

    const ended = watch(stateManager, { trigger: 'call', to: 'idle' });

    expect(await manager.start()).toBe(true);
    expect(manager.end()).toBe(true);

    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('should fire an answer trigger only for an inbound call that was answered', async () => {
    const { api, stateManager } = createAPIWithRealStateManager();
    const manager = new CallManager(api);
    manager.initialize();

    const answered = watch(stateManager, {
      trigger: 'call',
      from: 'ringing',
      to: 'answered',
    });

    expect(await manager.start({ inbound: true })).toBe(true);
    expect(answered).not.toHaveBeenCalled();

    expect(await manager.answer()).toBe(true);

    expect(answered).toHaveBeenCalledTimes(1);
  });

  it('should fire a reject trigger when an unanswered call times out', async () => {
    vi.useFakeTimers();
    const { api, stateManager } = createAPIWithRealStateManager({
      config: { live: { controls: { call: { unanswered_timeout_seconds: 60 } } } },
    });
    const manager = new CallManager(api);
    manager.initialize();

    const rejected = watch(stateManager, {
      trigger: 'call',
      from: 'ringing',
      to: 'idle',
    });
    const hungUp = watch(stateManager, {
      trigger: 'call',
      from: 'answered',
      to: 'idle',
    });

    expect(await manager.start({ inbound: true })).toBe(true);
    vi.advanceTimersByTime(60_000);

    expect(rejected).toHaveBeenCalledTimes(1);
    expect(hungUp).not.toHaveBeenCalled();
  });

  it('should fire a hangup trigger, not a reject, when an answered call ends', async () => {
    const { api, stateManager } = createAPIWithRealStateManager();
    const manager = new CallManager(api);
    manager.initialize();
    const rejected = watch(stateManager, {
      trigger: 'call',
      from: 'ringing',
      to: 'idle',
    });
    const hungUp = watch(stateManager, {
      trigger: 'call',
      from: 'answered',
      to: 'idle',
    });

    expect(await manager.start({ inbound: true })).toBe(true);
    expect(await manager.answer()).toBe(true);
    expect(manager.end()).toBe(true);

    expect(hungUp).toHaveBeenCalledTimes(1);
    expect(rejected).not.toHaveBeenCalled();
  });

  it('should fire a reject trigger when a ringing call is superseded', async () => {
    const { api, stateManager } = createAPIWithRealStateManager({
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
    manager.initialize();

    const rejected = watch(stateManager, {
      trigger: 'call',
      from: 'ringing',
      to: 'idle',
    });
    const ringing = watch(stateManager, { trigger: 'call', to: 'ringing' });

    expect(await manager.start({ inbound: true })).toBe(true);
    expect(await manager.start({ inbound: true, cameraID: 'camera.garage' })).toBe(true);

    // The superseded ring is observably ended before the replacement rings, so
    // an automation sees idle in between rather than one continuous call.
    expect(rejected).toHaveBeenCalledTimes(1);
    expect(ringing).toHaveBeenCalledTimes(2);
  });

  it('should publish idle when uninitialized during a call', async () => {
    const { api, stateManager } = createAPIWithRealStateManager();
    const manager = new CallManager(api);
    manager.initialize();
    const ended = watch(stateManager, { trigger: 'call', to: 'idle' });

    expect(await manager.start({ inbound: true })).toBe(true);
    manager.uninitialize();

    expect(ended).toHaveBeenCalledTimes(1);
  });
});
