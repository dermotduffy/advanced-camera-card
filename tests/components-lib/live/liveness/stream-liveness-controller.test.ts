import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { Camera } from '../../../../src/camera-manager/camera';
import type { StateWatcherSubscriptionInterface } from '../../../../src/card-controller/hass/state-watcher';
import { LIVENESS_ENTITY_UNAVAILABLE_GRACE_SECONDS } from '../../../../src/components-lib/live/liveness/detectors/entity-availability';
import { StreamLivenessController } from '../../../../src/components-lib/live/liveness/stream-liveness-controller';
import {
  dispatchLiveErrorEvent,
  type LiveError,
} from '../../../../src/components-lib/live/utils/dispatch-live-error';
import type { LivenessCallback, MediaPlayerController } from '../../../../src/types';
import { createCameraConfig } from '../../../config/test-utils';
import {
  callIntersectionHandler,
  callStateWatcherCallback,
  createHASS,
  createLitElement,
  createMediaLoadedInfo,
  createMediaLoadedInfoEvent,
  createStateEntity,
  IntersectionObserverMock,
} from '../../../test-utils';

const ISSUE_TRIGGER_EVENT = 'advanced-camera-card:issue:trigger';
const ISSUE_RESOLVE_EVENT = 'advanced-camera-card:issue:resolve';

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

  const issueResolves: unknown[] = [];
  host.addEventListener(ISSUE_RESOLVE_EVENT, (ev) =>
    issueResolves.push((ev as CustomEvent).detail),
  );

  const failViaProviderError = (error?: LiveError): void => {
    dispatchLiveErrorEvent(host, error);
  };

  return { host, controller, issueTriggers, issueResolves, failViaProviderError };
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
    expect(controller.getFailure()).toBeNull();
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

    // Provider-error is not-live but does not want a placeholder; its cause is
    // still available for a wrapper that fills the frame itself.
    expect(controller.isLive()).toBe(false);
    expect(controller.getFailure()).toEqual({
      reason: 'playback_error',
      renderPlaceholder: false,
    });
  });

  it("should carry the provider's error description into the failure and the issue", () => {
    const { controller, issueTriggers, failViaProviderError } = setup();
    controller.hostConnected();

    failViaProviderError({
      description: 'Failed to start WebRTC stream: no candidates',
    });

    expect(controller.getFailure()).toEqual({
      reason: 'playback_error',
      description: 'Failed to start WebRTC stream: no candidates',
      renderPlaceholder: false,
    });
    expect(issueTriggers).toEqual([
      {
        key: 'media_unavailable',
        targetID: 'camera.office',
        reason: 'playback_error',
        description: 'Failed to start WebRTC stream: no candidates',
      },
    ]);
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
    expect(controller.getFailure()).toEqual({
      reason: 'stalled',
      renderPlaceholder: true,
    });
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
    expect(controller.getFailure()).toEqual({
      reason: 'entity_unavailable',
      renderPlaceholder: true,
    });
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
    expect(controller.getFailure()).toBeNull();
    expect(issueTriggers).toEqual([]);

    vi.useRealTimers();
  });

  describe('resolving the issue', () => {
    const setupWithLiveStream = async () => {
      const result = setup();
      const { player, fireMediaPlayerLiveness } = createPlayer();

      result.controller.hostConnected();
      result.host.dispatchEvent(
        createMediaLoadedInfoEvent({
          info: createMediaLoadedInfo({ mediaPlayerController: player }),
        }),
      );
      await callIntersectionHandler(true);

      return { ...result, fireMediaPlayerLiveness };
    };

    it('should resolve when frames confirm the stream is flowing', async () => {
      const { issueResolves, fireMediaPlayerLiveness } = await setupWithLiveStream();

      fireMediaPlayerLiveness(true);

      expect(issueResolves).toEqual([
        { key: 'media_unavailable', targetID: 'camera.office' },
      ]);
    });

    it('should stop reporting a provider error once media loads', () => {
      const { host, controller, issueResolves, failViaProviderError } = setup();
      controller.hostConnected();
      failViaProviderError({ reason: 'not_loading' });

      host.dispatchEvent(createMediaLoadedInfoEvent({ info: createMediaLoadedInfo() }));

      // The detector holding the failure goes quiet rather than claiming the
      // stream is live, so this controller has nothing to state either way.
      expect(controller.isLive()).toBe(true);
      expect(issueResolves).toEqual([]);
    });

    it('should not resolve when media arrives with no failure to disprove', () => {
      const { host, controller, issueResolves } = setup();
      controller.hostConnected();

      host.dispatchEvent(createMediaLoadedInfoEvent({ info: createMediaLoadedInfo() }));

      expect(issueResolves).toEqual([]);
    });

    it('should not resolve while a hard failure exists', async () => {
      const { issueResolves, failViaProviderError, fireMediaPlayerLiveness } =
        await setupWithLiveStream();

      // A provider has authoritatively condemned the stream. Frames continuing
      // to arrive must not talk the card out of it.
      failViaProviderError();
      fireMediaPlayerLiveness(true);

      expect(issueResolves).toEqual([]);
    });

    it('should not resolve without a target', async () => {
      const result = setup({ targetID: null });
      const { player, fireMediaPlayerLiveness } = createPlayer();

      result.controller.hostConnected();
      result.host.dispatchEvent(
        createMediaLoadedInfoEvent({
          info: createMediaLoadedInfo({ mediaPlayerController: player }),
        }),
      );
      await callIntersectionHandler(true);
      fireMediaPlayerLiveness(true);

      expect(result.issueResolves).toEqual([]);
    });

    it('should not resolve on reconnect without fresh evidence', async () => {
      const { controller, issueResolves, fireMediaPlayerLiveness } =
        await setupWithLiveStream();
      fireMediaPlayerLiveness(true);
      issueResolves.length = 0;

      // Away and back with nothing observed in between: the previous `live` is
      // a memory of the old watch, not evidence about the new one.
      controller.hostDisconnected();
      controller.hostConnected();

      expect(issueResolves).toEqual([]);
    });

    it('should not announce recovery for a stream that was reset away', async () => {
      const { controller, issueResolves, fireMediaPlayerLiveness } =
        await setupWithLiveStream();
      fireMediaPlayerLiveness(true);
      issueResolves.length = 0;

      // The stream this `live` describes is being torn down, so resetting must
      // not report it as recovered.
      controller.reset();

      expect(issueResolves).toEqual([]);
    });

    it('should not mix a stale live verdict with a freshly reset one', async () => {
      const { controller, host, issueResolves, issueTriggers, failViaProviderError } =
        setup();
      const { player, fireMediaPlayerLiveness } = createPlayer();
      controller.hostConnected();
      host.dispatchEvent(
        createMediaLoadedInfoEvent({
          info: createMediaLoadedInfo({ mediaPlayerController: player }),
        }),
      );
      await callIntersectionHandler(true);

      // Frames say live, then a provider error condemns the stream. Both
      // verdicts are held at once, by different detectors.
      fireMediaPlayerLiveness(true);
      failViaProviderError();
      issueResolves.length = 0;
      issueTriggers.length = 0;

      // Resetting clears them in turn. If any detector announced part-way
      // through, the cleared provider error would leave the stale `live`
      // unopposed and the card would report a recovery that never happened.
      controller.reset();

      expect(issueResolves).toEqual([]);
      expect(issueTriggers).toEqual([]);
    });

    it('should re-read the detectors once they have all been reset', async () => {
      const { controller, host, fireMediaPlayerLiveness } = await setupWithLiveStream();
      fireMediaPlayerLiveness(true);
      vi.mocked(host.requestUpdate).mockClear();

      controller.reset();

      // Anything the detectors say while being reset is ignored, so this is the
      // single read the controller makes once they are all done.
      expect(host.requestUpdate).toHaveBeenCalledTimes(1);
      expect(controller.isLive()).toBe(true);
    });
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
    expect(controller.getFailure()).toEqual({
      reason: 'entity_unavailable',
      renderPlaceholder: true,
    });
  });
});
