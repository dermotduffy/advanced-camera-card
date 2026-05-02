import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { MediaLoadedInfoSourceController } from '../../src/components-lib/media-loaded-info-source-controller';
import { MediaPlayerController } from '../../src/types';
import { createLitElement, createMediaLoadedInfo } from '../test-utils';

// @vitest-environment jsdom
describe('MediaLoadedInfoSourceController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register itself with the host', () => {
    const host = createLitElement();
    const controller = new MediaLoadedInfoSourceController(host, {
      getTargetID: () => 'target-1',
    });

    expect(host.addController).toBeCalledWith(controller);
  });

  describe('set', () => {
    it('should reject when getTargetID returns null', () => {
      const host = createLitElement();
      const controller = new MediaLoadedInfoSourceController(host, {
        getTargetID: () => null,
      });

      const handler = vi.fn();
      host.addEventListener('advanced-camera-card:media:loaded', handler);

      controller.set(createMediaLoadedInfo());

      expect(handler).not.toBeCalled();
    });

    it('should dispatch a bubbling, composed event with info+targetID and signal', () => {
      const host = createLitElement();
      const controller = new MediaLoadedInfoSourceController(host, {
        getTargetID: () => 'target-1',
      });

      const handler = vi.fn();
      host.addEventListener('advanced-camera-card:media:loaded', handler);

      controller.set(createMediaLoadedInfo({ width: 320, height: 240 }));

      expect(handler).toBeCalledTimes(1);
      const ev = handler.mock.calls[0][0] as CustomEvent;
      expect(ev.bubbles).toBe(true);
      expect(ev.composed).toBe(true);

      // The source controller injects targetID from `getTargetID`; the
      // dispatched info carries it regardless of what the caller passed.
      expect(ev.detail.info).toEqual({
        width: 320,
        height: 240,
        targetID: 'target-1',
      });
      expect(ev.detail.signal).toBeInstanceOf(AbortSignal);
      expect(ev.detail.signal.aborted).toBe(false);
    });

    it('should dedup structurally-equal info', () => {
      const host = createLitElement();
      const controller = new MediaLoadedInfoSourceController(host, {
        getTargetID: () => 'target-1',
      });

      const handler = vi.fn();
      host.addEventListener('advanced-camera-card:media:loaded', handler);

      const player = mock<MediaPlayerController>();

      controller.set(
        createMediaLoadedInfo({ mediaPlayerController: player, technology: ['hls'] }),
      );

      // Same fields, different object identity. Should not redispatch.
      controller.set(
        createMediaLoadedInfo({ mediaPlayerController: player, technology: ['hls'] }),
      );

      expect(handler).toBeCalledTimes(1);
    });

    it('should redispatch when mediaPlayerController reference differs', () => {
      const host = createLitElement();
      const controller = new MediaLoadedInfoSourceController(host, {
        getTargetID: () => 'target-1',
      });

      const handler = vi.fn();
      host.addEventListener('advanced-camera-card:media:loaded', handler);

      const player1 = mock<MediaPlayerController>();
      const player2 = mock<MediaPlayerController>();

      controller.set(createMediaLoadedInfo({ mediaPlayerController: player1 }));
      controller.set(createMediaLoadedInfo({ mediaPlayerController: player2 }));

      expect(handler).toBeCalledTimes(2);
    });

    it('should redispatch when getTargetID changes between calls', () => {
      let targetID: string | null = 'target-1';
      const host = createLitElement();
      const controller = new MediaLoadedInfoSourceController(host, {
        getTargetID: () => targetID,
      });

      const handler = vi.fn();
      host.addEventListener('advanced-camera-card:media:loaded', handler);

      controller.set(createMediaLoadedInfo());
      targetID = 'target-2';
      controller.set(createMediaLoadedInfo());

      expect(handler).toBeCalledTimes(2);
      expect((handler.mock.calls[0][0] as CustomEvent).detail.info.targetID).toBe(
        'target-1',
      );
      expect((handler.mock.calls[1][0] as CustomEvent).detail.info.targetID).toBe(
        'target-2',
      );
    });

    it('should abort the prior dispatch when targetID changes between calls', () => {
      // Without this, the manager would zombie an entry under the old
      // targetID — its `onAbort` cleanup never fires because we never aborted
      // the prior signal before overwriting `_abort`.
      let targetID: string | null = 'target-1';
      const host = createLitElement();
      const controller = new MediaLoadedInfoSourceController(host, {
        getTargetID: () => targetID,
      });

      const handler = vi.fn();
      host.addEventListener('advanced-camera-card:media:loaded', handler);

      controller.set(createMediaLoadedInfo());
      const firstSignal = (handler.mock.calls[0][0] as CustomEvent).detail.signal;

      targetID = 'target-2';
      controller.set(createMediaLoadedInfo());

      // The prior signal aborted so consumers' cleanup runs.
      expect(firstSignal.aborted).toBe(true);
      const secondSignal = (handler.mock.calls[1][0] as CustomEvent).detail.signal;
      expect(secondSignal.aborted).toBe(false);
    });
  });

  describe('hostConnected', () => {
    it('should re-dispatch _lastSet on reconnect with a new AbortController', () => {
      const host = createLitElement();
      const controller = new MediaLoadedInfoSourceController(host, {
        getTargetID: () => 'target-1',
      });

      const handler = vi.fn();
      host.addEventListener('advanced-camera-card:media:loaded', handler);

      controller.set(createMediaLoadedInfo());
      const firstSignal = (handler.mock.calls[0][0] as CustomEvent).detail.signal;

      // Disconnect and reconnect — without a fresh `set`.
      controller.hostDisconnected();
      controller.hostConnected();

      expect(handler).toBeCalledTimes(2);
      const secondSignal = (handler.mock.calls[1][0] as CustomEvent).detail.signal;

      // The original signal aborted on disconnect, the new one is fresh.
      expect(firstSignal).not.toBe(secondSignal);
      expect(firstSignal.aborted).toBe(true);
      expect(secondSignal.aborted).toBe(false);
    });

    it('should be a no-op when there is nothing to re-dispatch', () => {
      const host = createLitElement();
      const controller = new MediaLoadedInfoSourceController(host, {
        getTargetID: () => 'target-1',
      });

      const handler = vi.fn();
      host.addEventListener('advanced-camera-card:media:loaded', handler);

      controller.hostConnected();

      expect(handler).not.toBeCalled();
    });

    it('should not redispatch if a registration is already active', () => {
      const host = createLitElement();
      const controller = new MediaLoadedInfoSourceController(host, {
        getTargetID: () => 'target-1',
      });

      const handler = vi.fn();
      host.addEventListener('advanced-camera-card:media:loaded', handler);

      controller.set(createMediaLoadedInfo());
      // Active registration, no disconnect — connect should be a no-op.
      controller.hostConnected();

      expect(handler).toBeCalledTimes(1);
    });

    it('should not replay stale info after targetID flips during disconnect', () => {
      // Bug scenario: getTargetID flips while we're disconnected; reconnect
      // must NOT redispatch the cached info under the stale targetID.
      let targetID: string | null = 'target-1';
      const host = createLitElement();
      const controller = new MediaLoadedInfoSourceController(host, {
        getTargetID: () => targetID,
      });

      const handler = vi.fn();
      host.addEventListener('advanced-camera-card:media:loaded', handler);

      controller.set(createMediaLoadedInfo());
      expect(handler).toBeCalledTimes(1);

      controller.hostDisconnected();

      // While disconnected, the host's targetID prop flips.
      targetID = 'target-2';
      controller.hostConnected();

      // No re-dispatch — the stale cache was discarded.
      expect(handler).toBeCalledTimes(1);

      // A subsequent set() under the new target dispatches fresh.
      controller.set(createMediaLoadedInfo({ width: 320, height: 240 }));
      expect(handler).toBeCalledTimes(2);
      expect((handler.mock.calls[1][0] as CustomEvent).detail.info.targetID).toBe(
        'target-2',
      );
    });
  });

  describe('hostDisconnected', () => {
    it('should abort the active controller so consumers clean up', () => {
      const host = createLitElement();
      const controller = new MediaLoadedInfoSourceController(host, {
        getTargetID: () => 'target-1',
      });

      const handler = vi.fn();
      host.addEventListener('advanced-camera-card:media:loaded', handler);

      controller.set(createMediaLoadedInfo());
      const signal = (handler.mock.calls[0][0] as CustomEvent).detail.signal;
      const cleanup = vi.fn();
      signal.addEventListener('abort', cleanup);

      controller.hostDisconnected();

      expect(cleanup).toBeCalled();
      expect(signal.aborted).toBe(true);
    });

    it('should be safe to call when nothing is active', () => {
      const host = createLitElement();
      const controller = new MediaLoadedInfoSourceController(host, {
        getTargetID: () => 'target-1',
      });

      // Should not throw.
      controller.hostDisconnected();
    });
  });
});
