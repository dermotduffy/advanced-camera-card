import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  IssueResolveEventData,
  IssueTriggerEventData,
} from '../../src/card-controller/issues/types';
import {
  MEDIA_LOADING_TIMEOUT_SECONDS,
  MediaLoadWatchdogController,
} from '../../src/components-lib/media-load-watchdog-controller';
import { createLitElement, createMediaLoadedInfo } from '../test-utils';

const TIMEOUT_MS = MEDIA_LOADING_TIMEOUT_SECONDS * 1000;

const createHarness = (options?: {
  targetID?: string | null;
  loadExpected?: boolean;
}) => {
  const host = createLitElement();
  let targetID = options?.targetID === undefined ? 'camera-1' : options.targetID;
  let loadExpected = options?.loadExpected ?? true;
  let attemptID = 0;

  const triggerRequests: IssueTriggerEventData[] = [];
  host.addEventListener('advanced-camera-card:issue:trigger', (ev: Event) => {
    triggerRequests.push((ev as CustomEvent<IssueTriggerEventData>).detail);
  });

  const resolveRequests: IssueResolveEventData[] = [];
  host.addEventListener('advanced-camera-card:issue:resolve', (ev: Event) => {
    resolveRequests.push((ev as CustomEvent<IssueResolveEventData>).detail);
  });

  const controller = new MediaLoadWatchdogController(host, {
    getTargetID: () => targetID,
    isLoadExpected: () => loadExpected,
    getAttemptID: () => attemptID,
  });

  return {
    host,
    controller,
    triggerRequests,
    resolveRequests,
    setTargetID: (value: string | null): void => {
      targetID = value;
    },
    setLoadExpected: (value: boolean): void => {
      loadExpected = value;
    },
    retryMedia: (): void => {
      attemptID++;
    },
    connect: (): void => controller.hostConnected(),
    disconnect: (): void => controller.hostDisconnected(),
    update: (): void => controller.hostUpdated(),

    // Deliver a `media:loaded` as a descendant player would, returning the
    // controller that makes that media go away.
    mediaLoaded: (loadedTargetID: string): AbortController => {
      const abort = new AbortController();
      host.dispatchEvent(
        new CustomEvent('advanced-camera-card:media:loaded', {
          bubbles: true,
          composed: true,
          detail: {
            info: createMediaLoadedInfo({ targetID: loadedTargetID }),
            signal: abort.signal,
          },
        }),
      );
      return abort;
    },
  };
};

// @vitest-environment jsdom
describe('MediaLoadWatchdogController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should register itself with the host', () => {
    const harness = createHarness();

    expect(harness.host.addController).toHaveBeenCalledWith(harness.controller);
  });

  it('should report a load that never arrives', () => {
    const harness = createHarness();
    harness.connect();

    vi.advanceTimersByTime(TIMEOUT_MS);

    expect(harness.triggerRequests).toEqual([
      { key: 'media_unavailable', targetID: 'camera-1', reason: 'not_loading' },
    ]);
  });

  it('should not report a load that arrives in time', () => {
    const harness = createHarness();
    harness.connect();

    vi.advanceTimersByTime(TIMEOUT_MS - 1);
    harness.mediaLoaded('camera-1');
    vi.advanceTimersByTime(TIMEOUT_MS);

    expect(harness.triggerRequests).toEqual([]);
  });

  it('should report only once for a target that stays hung', () => {
    const harness = createHarness();
    harness.connect();

    vi.advanceTimersByTime(TIMEOUT_MS);
    harness.update();
    vi.advanceTimersByTime(TIMEOUT_MS * 5);

    expect(harness.triggerRequests).toHaveLength(1);
  });

  it('should not wait when no load is expected', () => {
    const harness = createHarness({ loadExpected: false });
    harness.connect();

    vi.advanceTimersByTime(TIMEOUT_MS);

    expect(harness.triggerRequests).toEqual([]);
  });

  it('should not wait without a target', () => {
    const harness = createHarness({ targetID: null });
    harness.connect();

    vi.advanceTimersByTime(TIMEOUT_MS);

    expect(harness.triggerRequests).toEqual([]);
  });

  it('should give a fresh window to a load that becomes expected again', () => {
    const harness = createHarness({ loadExpected: false });
    harness.connect();

    vi.advanceTimersByTime(TIMEOUT_MS);
    harness.setLoadExpected(true);
    harness.update();

    vi.advanceTimersByTime(TIMEOUT_MS - 1);
    expect(harness.triggerRequests).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(harness.triggerRequests).toHaveLength(1);
  });

  it('should not report once the host stops expecting a load', () => {
    const harness = createHarness();
    harness.connect();

    vi.advanceTimersByTime(TIMEOUT_MS - 1);
    harness.setLoadExpected(false);
    vi.advanceTimersByTime(1);

    expect(harness.triggerRequests).toEqual([]);
  });

  describe('clearing a reported failure', () => {
    it('should clear the failure when media arrives', () => {
      const harness = createHarness();
      harness.connect();

      vi.advanceTimersByTime(TIMEOUT_MS);
      harness.mediaLoaded('camera-1');

      expect(harness.resolveRequests).toEqual([
        { key: 'media_unavailable', targetID: 'camera-1', cause: 'media-loaded' },
      ]);
    });

    it('should resolve on a load even when it reported no failure itself', () => {
      const harness = createHarness();
      harness.connect();

      // A load resolves whatever failure the target has regardless of the
      // component that reported it -- not only this watchdog's own timeout.
      harness.mediaLoaded('camera-1');

      expect(harness.resolveRequests).toEqual([
        { key: 'media_unavailable', targetID: 'camera-1', cause: 'media-loaded' },
      ]);
    });

    it('should not clear anything for a load belonging to another target', () => {
      const harness = createHarness();
      harness.connect();

      harness.mediaLoaded('camera-2');

      expect(harness.resolveRequests).toEqual([]);
    });
  });

  describe('media going away', () => {
    it('should wait again when loaded media goes away', () => {
      const harness = createHarness();
      harness.connect();

      const abort = harness.mediaLoaded('camera-1');
      vi.advanceTimersByTime(TIMEOUT_MS * 2);
      expect(harness.triggerRequests).toEqual([]);

      abort.abort();
      vi.advanceTimersByTime(TIMEOUT_MS);

      expect(harness.triggerRequests).toHaveLength(1);
    });

    it('should ignore an older load going away after a newer one', () => {
      const harness = createHarness();
      harness.connect();

      const stale = harness.mediaLoaded('camera-1');
      harness.mediaLoaded('camera-1');

      stale.abort();
      vi.advanceTimersByTime(TIMEOUT_MS);

      expect(harness.triggerRequests).toEqual([]);
    });

    it('should wait again when media went away while the host was disconnected', () => {
      const harness = createHarness();
      harness.connect();

      const abort = harness.mediaLoaded('camera-1');
      harness.disconnect();
      abort.abort();

      // A detached host is not waited on, so nothing is reported yet.
      vi.advanceTimersByTime(TIMEOUT_MS);
      expect(harness.triggerRequests).toEqual([]);

      // The media that went away is gone on return, so the wait resumes rather
      // than the host being taken to still have it.
      harness.connect();
      vi.advanceTimersByTime(TIMEOUT_MS);

      expect(harness.triggerRequests).toEqual([
        { key: 'media_unavailable', targetID: 'camera-1', reason: 'not_loading' },
      ]);
    });
  });

  describe('a host reused for another target', () => {
    it('should not treat a load for another target as its own', () => {
      const harness = createHarness();
      harness.connect();

      harness.mediaLoaded('camera-2');
      vi.advanceTimersByTime(TIMEOUT_MS);

      expect(harness.triggerRequests).toEqual([
        { key: 'media_unavailable', targetID: 'camera-1', reason: 'not_loading' },
      ]);
    });

    it('should not carry a previous load over to the next target', () => {
      const harness = createHarness();
      harness.connect();
      harness.mediaLoaded('camera-1');

      harness.setTargetID('camera-2');
      harness.update();
      vi.advanceTimersByTime(TIMEOUT_MS);

      expect(harness.triggerRequests).toEqual([
        { key: 'media_unavailable', targetID: 'camera-2', reason: 'not_loading' },
      ]);
    });

    it('should give the next target a full window rather than what remained', () => {
      const harness = createHarness();
      harness.connect();

      vi.advanceTimersByTime(TIMEOUT_MS - 1);
      harness.setTargetID('camera-2');
      harness.update();

      vi.advanceTimersByTime(TIMEOUT_MS - 1);
      expect(harness.triggerRequests).toEqual([]);

      vi.advanceTimersByTime(1);
      expect(harness.triggerRequests).toEqual([
        { key: 'media_unavailable', targetID: 'camera-2', reason: 'not_loading' },
      ]);
    });

    it('should report the next target after the previous one was reported', () => {
      const harness = createHarness();
      harness.connect();

      vi.advanceTimersByTime(TIMEOUT_MS);
      harness.setTargetID('camera-2');
      harness.update();
      vi.advanceTimersByTime(TIMEOUT_MS);

      expect(harness.triggerRequests).toEqual([
        { key: 'media_unavailable', targetID: 'camera-1', reason: 'not_loading' },
        { key: 'media_unavailable', targetID: 'camera-2', reason: 'not_loading' },
      ]);
    });

    it('should resolve a failure it reported for the previous target', () => {
      const harness = createHarness();
      harness.connect();

      vi.advanceTimersByTime(TIMEOUT_MS);
      harness.setTargetID('camera-2');
      harness.update();

      // Nothing watches camera-1 now, so nothing could ever say it recovered.
      expect(harness.resolveRequests).toEqual([
        { key: 'media_unavailable', targetID: 'camera-1', reason: 'not_loading' },
      ]);
    });

    it('should resolve a failure when the next target loads immediately', () => {
      const harness = createHarness();
      harness.connect();

      vi.advanceTimersByTime(TIMEOUT_MS);
      harness.setTargetID('camera-2');
      harness.mediaLoaded('camera-2');

      // The abandoned target gets only its not-loading failure resolved: no
      // load arrived for it.
      expect(harness.resolveRequests).toEqual([
        { key: 'media_unavailable', targetID: 'camera-1', reason: 'not_loading' },
        { key: 'media_unavailable', targetID: 'camera-2', cause: 'media-loaded' },
      ]);
    });

    it('should resolve nothing when it reported no failure', () => {
      const harness = createHarness();
      harness.connect();

      harness.setTargetID('camera-2');
      harness.update();

      expect(harness.resolveRequests).toEqual([]);
    });
  });

  describe('connection', () => {
    it('should not wait while disconnected', () => {
      const harness = createHarness();
      harness.connect();

      vi.advanceTimersByTime(TIMEOUT_MS - 1);
      harness.disconnect();
      vi.advanceTimersByTime(TIMEOUT_MS);

      expect(harness.triggerRequests).toEqual([]);
    });

    it('should give a fresh window on reconnect', () => {
      const harness = createHarness();
      harness.connect();
      harness.disconnect();
      harness.connect();

      vi.advanceTimersByTime(TIMEOUT_MS - 1);
      expect(harness.triggerRequests).toEqual([]);

      vi.advanceTimersByTime(1);
      expect(harness.triggerRequests).toHaveLength(1);
    });

    it('should ignore a host update while disconnected', () => {
      const harness = createHarness();

      harness.update();
      vi.advanceTimersByTime(TIMEOUT_MS);

      expect(harness.triggerRequests).toEqual([]);
    });
  });

  describe('a rebuilt attempt at the same target', () => {
    it('should wait again after the media underneath is rebuilt', () => {
      const harness = createHarness();
      harness.connect();
      harness.mediaLoaded('camera-1');

      harness.retryMedia();
      harness.update();
      vi.advanceTimersByTime(TIMEOUT_MS);

      expect(harness.triggerRequests).toHaveLength(1);
    });

    it('should report again after a retry of a target already reported', () => {
      const harness = createHarness();
      harness.connect();

      vi.advanceTimersByTime(TIMEOUT_MS);
      harness.retryMedia();
      harness.update();
      vi.advanceTimersByTime(TIMEOUT_MS);

      expect(harness.triggerRequests).toHaveLength(2);
    });

    it('should not report an attempt the retry has already replaced', () => {
      const harness = createHarness();
      harness.connect();

      // The retry lands while the window for the previous attempt is still
      // maturing, and the host has not been updated yet.
      vi.advanceTimersByTime(TIMEOUT_MS - 1);
      harness.retryMedia();
      vi.advanceTimersByTime(1);

      expect(harness.triggerRequests).toEqual([]);
    });

    it('should keep a reported failure visible while the retry runs', () => {
      const harness = createHarness();
      harness.connect();

      vi.advanceTimersByTime(TIMEOUT_MS);
      harness.retryMedia();
      harness.update();

      // The target is unchanged, so the failure still describes it until the
      // retried media either arrives or hangs in its turn.
      expect(harness.resolveRequests).toEqual([]);
    });

    it('should give the rebuilt attempt a full window', () => {
      const harness = createHarness();
      harness.connect();

      vi.advanceTimersByTime(TIMEOUT_MS - 1);
      harness.retryMedia();
      harness.update();

      vi.advanceTimersByTime(TIMEOUT_MS - 1);
      expect(harness.triggerRequests).toEqual([]);

      vi.advanceTimersByTime(1);
      expect(harness.triggerRequests).toHaveLength(1);
    });
  });
});
