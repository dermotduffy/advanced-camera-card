import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { MediaPlayerLivenessDetector } from '../../../../../src/components-lib/live/liveness/detectors/media-player-liveness';
import type { LivenessCallback, MediaPlayerController } from '../../../../../src/types';
import {
  callIntersectionHandler,
  createMediaLoadedInfo,
  createMediaLoadedInfoEvent,
  IntersectionObserverMock,
} from '../../../../test-utils';

const createPlayer = (): {
  player: MediaPlayerController;
  unsubscribe: ReturnType<typeof vi.fn>;
  fireMediaPlayerLiveness: (isLive: boolean) => void;
} => {
  const player = mock<MediaPlayerController>();
  const unsubscribe = vi.fn();
  let captured: LivenessCallback | null = null;
  player.subscribeLiveness = vi.fn((callback: LivenessCallback) => {
    captured = callback;
    return unsubscribe;
  });
  return {
    player,
    unsubscribe,
    fireMediaPlayerLiveness: (isLive: boolean) => captured?.(isLive),
  };
};

const setup = () => {
  const host = document.createElement('div');
  document.body.append(host);
  const onChange = vi.fn();
  const detector = new MediaPlayerLivenessDetector(host, onChange);

  const loadMedia = (player?: MediaPlayerController, signal?: AbortSignal): void => {
    host.dispatchEvent(
      createMediaLoadedInfoEvent({
        info: createMediaLoadedInfo({ mediaPlayerController: player }),
        signal,
      }),
    );
  };

  return { host, onChange, detector, loadMedia };
};

// @vitest-environment jsdom
describe('MediaPlayerLivenessDetector', () => {
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

  it('should start unknown', () => {
    const { detector } = setup();

    expect(detector.getVerdict()).toEqual({ state: 'unknown' });
  });

  it('should watch liveness only once both visible and media are loaded', async () => {
    const { detector, loadMedia } = setup();
    const { player } = createPlayer();
    detector.subscribe();

    // Media loaded but not yet visible -> not watched.
    loadMedia(player);
    expect(player.subscribeLiveness).not.toHaveBeenCalled();

    // Becoming visible (initial intersection baseline, via emitInitial) -> watch.
    await callIntersectionHandler(true);
    expect(player.subscribeLiveness).toHaveBeenCalledTimes(1);
  });

  it('should report a stall as not live with a reconnecting placeholder', async () => {
    const { detector, onChange, loadMedia } = setup();
    const { player, fireMediaPlayerLiveness } = createPlayer();
    detector.subscribe();
    loadMedia(player);
    await callIntersectionHandler(true);

    fireMediaPlayerLiveness(false);

    expect(detector.getVerdict()).toEqual({
      state: 'not_live',
      authority: 'direct',
      renderPlaceholder: true,
      reason: 'stalled',
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('should report live again when the stream recovers', async () => {
    const { detector, loadMedia } = setup();
    const { player, fireMediaPlayerLiveness } = createPlayer();
    detector.subscribe();
    loadMedia(player);
    await callIntersectionHandler(true);

    fireMediaPlayerLiveness(false);
    fireMediaPlayerLiveness(true);

    expect(detector.getVerdict()).toEqual({ state: 'live', authority: 'direct' });
  });

  it('should not re-notify when the liveness verdict is unchanged', async () => {
    const { detector, onChange, loadMedia } = setup();
    const { player, fireMediaPlayerLiveness } = createPlayer();
    detector.subscribe();
    loadMedia(player);
    await callIntersectionHandler(true);

    fireMediaPlayerLiveness(false);
    fireMediaPlayerLiveness(false);

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('should stop watching when it becomes not visible', async () => {
    const { detector, loadMedia } = setup();
    const { player, unsubscribe } = createPlayer();
    detector.subscribe();
    loadMedia(player);
    await callIntersectionHandler(true);

    await callIntersectionHandler(false);

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('should report unknown after going off-screen while confirmed live', async () => {
    const { detector, onChange, loadMedia } = setup();
    const { player, fireMediaPlayerLiveness } = createPlayer();
    detector.subscribe();
    loadMedia(player);
    await callIntersectionHandler(true);

    fireMediaPlayerLiveness(true);
    expect(detector.getVerdict()).toEqual({ state: 'live', authority: 'direct' });
    onChange.mockClear();

    await callIntersectionHandler(false);

    // Off-screen: no current frame evidence, so drop the stale `live` to
    // `unknown` rather than suppressing the entity proxy with stale confidence.
    expect(detector.getVerdict()).toEqual({ state: 'unknown' });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('should discard a retained live verdict when watching resumes', async () => {
    const { detector, onChange, loadMedia } = setup();
    const { player, fireMediaPlayerLiveness } = createPlayer();
    detector.subscribe();
    loadMedia(player);
    await callIntersectionHandler(true);
    fireMediaPlayerLiveness(true);

    // Away and back with nothing observed in between. The retained `live`
    // describes the previous watch, so it must not survive into this one.
    detector.unsubscribe();
    onChange.mockClear();
    detector.subscribe();
    loadMedia(player);
    await callIntersectionHandler(true);

    expect(detector.getVerdict()).toEqual({ state: 'unknown' });
    expect(onChange).toHaveBeenCalled();
  });

  it('should not watch a player without the liveness capability', async () => {
    const { detector, onChange, loadMedia } = setup();
    const player = mock<MediaPlayerController>();
    player.subscribeLiveness = undefined;
    detector.subscribe();

    loadMedia(player);
    await callIntersectionHandler(true);

    expect(detector.getVerdict()).toEqual({ state: 'unknown' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should hold the not-live verdict when the frozen media unmounts', async () => {
    const { detector, loadMedia } = setup();
    const { player, unsubscribe, fireMediaPlayerLiveness } = createPlayer();
    const abort = new AbortController();
    detector.subscribe();
    loadMedia(player, abort.signal);
    await callIntersectionHandler(true);
    fireMediaPlayerLiveness(false);

    // The placeholder unmounts the frozen stream -> the media aborts.
    abort.abort();

    expect(unsubscribe).toHaveBeenCalledTimes(1);

    // Verdict held, not reset to live -- recovery is the throttled remount.
    expect(detector.getVerdict()).toEqual({
      state: 'not_live',
      authority: 'direct',
      renderPlaceholder: true,
      reason: 'stalled',
    });
  });

  it('should drop a confirmed-live verdict to unknown when the media unmounts externally', async () => {
    const { detector, loadMedia } = setup();
    const { player, fireMediaPlayerLiveness } = createPlayer();
    const abort = new AbortController();
    detector.subscribe();
    loadMedia(player, abort.signal);

    await callIntersectionHandler(true);
    fireMediaPlayerLiveness(true);

    expect(detector.getVerdict()).toEqual({ state: 'live', authority: 'direct' });

    // The media unmounts while confirmed live (an ordinary unload, not our own
    // not-live placeholder). Drop the stale `live` to `unknown` so it does not
    // suppress other detectors (e.g. entity availability).
    abort.abort();

    expect(detector.getVerdict()).toEqual({ state: 'unknown' });
  });

  it('should discard the verdict on reset', async () => {
    const { detector, loadMedia } = setup();
    const { player, unsubscribe, fireMediaPlayerLiveness } = createPlayer();
    detector.subscribe();
    loadMedia(player);

    await callIntersectionHandler(true);
    fireMediaPlayerLiveness(false);

    detector.reset();

    expect(detector.getVerdict()).toEqual({ state: 'unknown' });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('should tear down the watch and stop listening on unsubscribe', async () => {
    const { detector, loadMedia } = setup();
    const first = createPlayer();
    detector.subscribe();
    loadMedia(first.player);

    await callIntersectionHandler(true);

    detector.unsubscribe();
    expect(first.unsubscribe).toHaveBeenCalledTimes(1);

    // A later media:loaded is ignored (listener removed).
    const second = createPlayer();
    loadMedia(second.player);
    expect(second.player.subscribeLiveness).not.toHaveBeenCalled();
  });

  it('should not watch when media loads without a player controller', async () => {
    const { detector, onChange, loadMedia } = setup();
    detector.subscribe();

    loadMedia(undefined);
    await callIntersectionHandler(true);

    expect(detector.getVerdict()).toEqual({ state: 'unknown' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should ignore a stale media abort after a newer load', async () => {
    const { detector, loadMedia } = setup();
    const first = createPlayer();
    const second = createPlayer();
    const abortFirst = new AbortController();
    detector.subscribe();

    loadMedia(first.player, abortFirst.signal);
    loadMedia(second.player);
    await callIntersectionHandler(true);

    // The stale abort of the first load must not drop the current player.
    abortFirst.abort();
    second.fireMediaPlayerLiveness(false);

    expect(detector.getVerdict()).toEqual({
      state: 'not_live',
      authority: 'direct',
      renderPlaceholder: true,
      reason: 'stalled',
    });
  });
});
