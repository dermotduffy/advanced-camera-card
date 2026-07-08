import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { Camera } from '../../../../src/camera-manager/camera';
import type { StateWatcherSubscriptionInterface } from '../../../../src/card-controller/hass/state-watcher';
import { LIVENESS_ENTITY_UNAVAILABLE_GRACE_SECONDS } from '../../../../src/components-lib/live/liveness/detectors/entity-availability';
import { StreamLivenessController } from '../../../../src/components-lib/live/liveness/stream-liveness-controller';
import type { LivenessCallback, MediaPlayerController } from '../../../../src/types';
import {
  callIntersectionHandler,
  callStateWatcherCallback,
  createCameraConfig,
  createHASS,
  createLitElement,
  createMediaLoadedInfo,
  createMediaLoadedInfoEvent,
  createStateEntity,
  IntersectionObserverMock,
} from '../../../test-utils';

const LIVE_ERROR_EVENT = 'advanced-camera-card:live:error';
const ISSUE_TRIGGER_EVENT = 'advanced-camera-card:issue:trigger';

const setup = (options?: { targetID?: string | null }) => {
  const host = createLitElement();
  document.body.append(host);

  const controller = new StreamLivenessController(host, {
    getTargetID: () =>
      options?.targetID === undefined ? 'camera.office' : options.targetID,
    getHASS: () => null,
    getCamera: () => null,
    getStateWatcher: () => null,
  });

  const issueTriggers: unknown[] = [];
  host.addEventListener(ISSUE_TRIGGER_EVENT, (ev) =>
    issueTriggers.push((ev as CustomEvent).detail),
  );

  const failViaProviderError = (): void => {
    host.dispatchEvent(new Event(LIVE_ERROR_EVENT, { bubbles: true }));
  };

  return { host, controller, issueTriggers, failViaProviderError };
};

const createPlayer = (): {
  player: MediaPlayerController;
  fireMediaPlayerLiveness: (isLive: boolean) => void;
} => {
  const player = mock<MediaPlayerController>();
  let captured: LivenessCallback | null = null;
  player.subscribeLiveness = vi.fn((callback: LivenessCallback) => {
    captured = callback;
    return vi.fn();
  });
  return { player, fireMediaPlayerLiveness: (isLive: boolean) => captured?.(isLive) };
};

// @vitest-environment jsdom
describe('StreamLivenessController', () => {
  beforeAll(() => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
    vi.spyOn(global.document, 'addEventListener');
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
  });

  it('should register itself as a controller on the host', () => {
    const { host, controller } = setup();

    expect(host.addController).toHaveBeenCalledWith(controller);
  });

  it('should be live with no placeholder by default', () => {
    const { controller } = setup();

    expect(controller.isLive()).toBe(true);
    expect(controller.getPlaceholder()).toBeNull();
  });

  it('should aggregate a detector losing liveness only after host connect', () => {
    const { controller, failViaProviderError } = setup();

    // Not yet connected -> the provider-error listener is not attached.
    failViaProviderError();
    expect(controller.isLive()).toBe(true);

    controller.hostConnected();
    failViaProviderError();

    expect(controller.isLive()).toBe(false);
  });

  it('should fire the media_unavailable issue and request an update when liveness is lost', () => {
    const { host, controller, issueTriggers, failViaProviderError } = setup();
    controller.hostConnected();

    failViaProviderError();

    expect(issueTriggers).toEqual([
      { key: 'media_unavailable', targetID: 'camera.office', reason: 'playback_error' },
    ]);
    expect(host.requestUpdate).toHaveBeenCalled();
  });

  it('should not request a placeholder when the detector renders its own error', () => {
    const { controller, failViaProviderError } = setup();
    controller.hostConnected();

    failViaProviderError();

    // Provider-error is not-live but does not want a placeholder.
    expect(controller.isLive()).toBe(false);
    expect(controller.getPlaceholder()).toBeNull();
  });

  it('should not fire the issue without a target', () => {
    const { host, controller, issueTriggers, failViaProviderError } = setup({
      targetID: null,
    });
    controller.hostConnected();

    failViaProviderError();

    expect(issueTriggers).toEqual([]);
    expect(host.requestUpdate).toHaveBeenCalled();
  });

  it('should request a placeholder when a detector reports a silent freeze', async () => {
    const { host, controller, issueTriggers } = setup();
    const { player, fireMediaPlayerLiveness } = createPlayer();
    controller.hostConnected();

    host.dispatchEvent(
      createMediaLoadedInfoEvent({
        info: createMediaLoadedInfo({ mediaPlayerController: player }),
      }),
    );
    await callIntersectionHandler(true);
    fireMediaPlayerLiveness(false);

    expect(controller.isLive()).toBe(false);
    expect(controller.getPlaceholder()).toEqual({ reason: 'stalled' });
    expect(issueTriggers).toEqual([
      { key: 'media_unavailable', targetID: 'camera.office', reason: 'stalled' },
    ]);
  });

  it('should stop aggregating detector inputs after host disconnect', () => {
    const { controller, failViaProviderError } = setup();
    controller.hostConnected();
    controller.hostDisconnected();

    failViaProviderError();

    expect(controller.isLive()).toBe(true);
  });

  it('should reset all detectors', () => {
    const { controller, failViaProviderError } = setup();
    controller.hostConnected();
    failViaProviderError();
    expect(controller.isLive()).toBe(false);

    controller.reset();

    expect(controller.isLive()).toBe(true);
  });

  it('should request an update without an issue when liveness recovers', async () => {
    const { host, controller, issueTriggers } = setup();
    const { player, fireMediaPlayerLiveness } = createPlayer();
    controller.hostConnected();
    host.dispatchEvent(
      createMediaLoadedInfoEvent({
        info: createMediaLoadedInfo({ mediaPlayerController: player }),
      }),
    );
    await callIntersectionHandler(true);
    fireMediaPlayerLiveness(false);
    issueTriggers.length = 0;
    vi.mocked(host.requestUpdate).mockClear();

    fireMediaPlayerLiveness(true);

    expect(issueTriggers).toEqual([]);
    expect(host.requestUpdate).toHaveBeenCalled();
  });

  it('should surface an always_error unavailable entity as a placeholder', () => {
    const host = createLitElement();
    document.body.append(host);
    const stateWatcher = mock<StateWatcherSubscriptionInterface>();
    stateWatcher.subscribe.mockReturnValue(true);
    const camera = mock<Camera>();
    camera.getConfig.mockReturnValue(
      createCameraConfig({
        camera_entity: 'camera.office',
        always_error_if_entity_unavailable: true,
      }),
    );
    let currentCamera: Camera | null = camera;
    const hass = createHASS({
      'camera.office': createStateEntity({ state: 'unavailable' }),
    });

    const controller = new StreamLivenessController(host, {
      getTargetID: () => 'camera.office',
      getHASS: () => hass,
      getCamera: () => currentCamera,
      getStateWatcher: () => stateWatcher,
    });
    const issueTriggers: unknown[] = [];
    host.addEventListener(ISSUE_TRIGGER_EVENT, (ev) =>
      issueTriggers.push((ev as CustomEvent).detail),
    );

    controller.hostConnected();

    expect(controller.isLive()).toBe(false);
    expect(controller.getPlaceholder()).toEqual({ reason: 'entity_unavailable' });
    expect(issueTriggers).toEqual([
      {
        key: 'media_unavailable',
        targetID: 'camera.office',
        reason: 'entity_unavailable',
      },
    ]);

    // The camera reference is removed while the entity is still watched; the
    // always_error lookup must tolerate a now-null camera and leave the
    // already-not-live verdict unchanged.
    currentCamera = null;
    callStateWatcherCallback(stateWatcher, {
      entityID: 'camera.office',
      newState: createStateEntity({ state: 'unavailable' }),
    });

    expect(controller.isLive()).toBe(false);
  });

  it('should keep a frame-confirmed stream live despite an unavailable entity', async () => {
    vi.useFakeTimers();
    const host = createLitElement();
    document.body.append(host);

    const stateWatcher = mock<StateWatcherSubscriptionInterface>();
    stateWatcher.subscribe.mockReturnValue(true);

    const camera = mock<Camera>();
    camera.getConfig.mockReturnValue(
      createCameraConfig({ camera_entity: 'camera.office' }),
    );

    const hass = createHASS({
      'camera.office': createStateEntity({ state: 'unavailable' }),
    });

    const controller = new StreamLivenessController(host, {
      getTargetID: () => 'camera.office',
      getHASS: () => hass,
      getCamera: () => camera,
      getStateWatcher: () => stateWatcher,
    });

    const issueTriggers: unknown[] = [];
    host.addEventListener(ISSUE_TRIGGER_EVENT, (ev) =>
      issueTriggers.push((ev as CustomEvent).detail),
    );
    const { player, fireMediaPlayerLiveness } = createPlayer();

    controller.hostConnected();
    host.dispatchEvent(
      createMediaLoadedInfoEvent({
        info: createMediaLoadedInfo({ mediaPlayerController: player }),
      }),
    );
    await callIntersectionHandler(true);

    // Frames confirm the stream is live, then the entity blips unavailable past
    // its grace window.
    fireMediaPlayerLiveness(true);
    vi.advanceTimersByTime(LIVENESS_ENTITY_UNAVAILABLE_GRACE_SECONDS * 1000);

    // Direct frame evidence outranks the entity proxy: no teardown, no issue.
    expect(controller.isLive()).toBe(true);
    expect(controller.getPlaceholder()).toBeNull();
    expect(issueTriggers).toEqual([]);

    vi.useRealTimers();
  });

  it('should report not live despite confirmed frames when always_error overrides', async () => {
    const host = createLitElement();
    document.body.append(host);

    const stateWatcher = mock<StateWatcherSubscriptionInterface>();
    stateWatcher.subscribe.mockReturnValue(true);

    const camera = mock<Camera>();
    camera.getConfig.mockReturnValue(
      createCameraConfig({
        camera_entity: 'camera.office',
        always_error_if_entity_unavailable: true,
      }),
    );

    const hass = createHASS({
      'camera.office': createStateEntity({ state: 'unavailable' }),
    });

    const controller = new StreamLivenessController(host, {
      getTargetID: () => 'camera.office',
      getHASS: () => hass,
      getCamera: () => camera,
      getStateWatcher: () => stateWatcher,
    });
    const { player, fireMediaPlayerLiveness } = createPlayer();

    controller.hostConnected();
    host.dispatchEvent(
      createMediaLoadedInfoEvent({
        info: createMediaLoadedInfo({ mediaPlayerController: player }),
      }),
    );
    await callIntersectionHandler(true);
    fireMediaPlayerLiveness(true);

    // The always_error opt-in is authoritative: an unavailable entity overrides
    // even confirmed frames.
    expect(controller.isLive()).toBe(false);
    expect(controller.getPlaceholder()).toEqual({ reason: 'entity_unavailable' });
  });
});
