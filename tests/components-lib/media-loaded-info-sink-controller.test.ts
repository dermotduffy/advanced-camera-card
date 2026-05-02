import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaLoadedInfoSinkController } from '../../src/components-lib/media-loaded-info-sink-controller';
import {
  createLitElement,
  createMediaLoadedInfo,
  createMediaLoadedInfoEvent,
} from '../test-utils';

// @vitest-environment jsdom
describe('MediaLoadedInfoSinkController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register itself with the host', () => {
    const host = createLitElement();
    const controller = new MediaLoadedInfoSinkController(host, {
      getTargetID: () => 'target-1',
    });

    expect(host.addController).toBeCalledWith(controller);
  });

  it('should default to an empty info', () => {
    const host = createLitElement();
    const controller = new MediaLoadedInfoSinkController(host, {
      getTargetID: () => 'target-1',
    });

    expect(controller.has()).toBeFalsy();
    expect(controller.get()).toBeNull();
  });

  it('should return null when getTargetID returns null', () => {
    const host = createLitElement();
    const controller = new MediaLoadedInfoSinkController(host, {
      getTargetID: () => null,
    });
    controller.hostConnected();

    host.dispatchEvent(createMediaLoadedInfoEvent());

    expect(controller.has()).toBeFalsy();
    expect(controller.get()).toBeNull();
  });

  describe('per-target caching', () => {
    it('should expose only the selected target', () => {
      let selected: string | null = 'target-A';
      const host = createLitElement();
      const controller = new MediaLoadedInfoSinkController(host, {
        getTargetID: () => selected,
      });
      controller.hostConnected();

      const infoA = createMediaLoadedInfo({ targetID: 'target-A' });
      const infoB = createMediaLoadedInfo({ targetID: 'target-B' });
      host.dispatchEvent(createMediaLoadedInfoEvent({ info: infoA }));
      host.dispatchEvent(createMediaLoadedInfoEvent({ info: infoB }));

      // Both cached, but only the selected one is exposed.
      expect(controller.get()).toBe(infoA);

      // Selecting the other target switches what `get()` returns — without a
      // new event arriving for it.
      selected = 'target-B';
      controller.hostUpdated();
      expect(controller.get()).toBe(infoB);
    });

    it('should fire callback when selection changes the active info', () => {
      let selected: string | null = 'target-A';
      const callback = vi.fn();
      const host = createLitElement();
      const controller = new MediaLoadedInfoSinkController(host, {
        getTargetID: () => selected,
        callback,
      });
      controller.hostConnected();

      const infoA = createMediaLoadedInfo({ targetID: 'target-A' });
      const infoB = createMediaLoadedInfo({ targetID: 'target-B' });
      host.dispatchEvent(createMediaLoadedInfoEvent({ info: infoA }));
      host.dispatchEvent(createMediaLoadedInfoEvent({ info: infoB }));
      vi.clearAllMocks();

      // Selection change to a target whose info is already cached.
      selected = 'target-B';
      controller.hostUpdated();

      expect(callback).toBeCalledWith(infoB);
      expect(host.requestUpdate).toBeCalled();
    });

    it('should not fire callback for non-selected target loads', () => {
      const callback = vi.fn();
      const host = createLitElement();
      const controller = new MediaLoadedInfoSinkController(host, {
        getTargetID: () => 'target-A',
        callback,
      });
      controller.hostConnected();
      vi.clearAllMocks();

      // Load for an unselected target — cached but inactive.
      host.dispatchEvent(
        createMediaLoadedInfoEvent({
          info: createMediaLoadedInfo({ targetID: 'target-B' }),
        }),
      );

      expect(callback).not.toBeCalled();
      expect(host.requestUpdate).not.toBeCalled();
    });

    it('should fire callback for selected target loads', () => {
      const callback = vi.fn();
      const host = createLitElement();
      const controller = new MediaLoadedInfoSinkController(host, {
        getTargetID: () => 'target-A',
        callback,
      });
      controller.hostConnected();
      vi.clearAllMocks();

      const info = createMediaLoadedInfo({ targetID: 'target-A' });
      host.dispatchEvent(createMediaLoadedInfoEvent({ info }));

      expect(callback).toBeCalledWith(info);
      expect(host.requestUpdate).toBeCalled();
    });

    it('should not re-fire callback when hostUpdated runs without a targetID change', () => {
      const callback = vi.fn();
      const host = createLitElement();
      const controller = new MediaLoadedInfoSinkController(host, {
        getTargetID: () => 'target-A',
        callback,
      });
      controller.hostConnected();

      const info = createMediaLoadedInfo({ targetID: 'target-A' });
      host.dispatchEvent(createMediaLoadedInfoEvent({ info }));
      vi.clearAllMocks();

      // Repeated host updates with no targetID change: no callback re-fire.
      controller.hostUpdated();
      controller.hostUpdated();

      expect(callback).not.toBeCalled();
    });

    it('should not fire callback when selection switches between empty targets', () => {
      let selected: string | null = 'target-A';
      const callback = vi.fn();
      const host = createLitElement();
      const controller = new MediaLoadedInfoSinkController(host, {
        getTargetID: () => selected,
        callback,
      });
      controller.hostConnected();
      controller.hostUpdated();
      vi.clearAllMocks();

      // Switch to another target with no cached info — active stays null.
      selected = 'target-B';
      controller.hostUpdated();

      expect(callback).not.toBeCalled();
    });

    it('should ignore events whose info has no targetID', () => {
      const callback = vi.fn();
      const host = createLitElement();
      const controller = new MediaLoadedInfoSinkController(host, {
        getTargetID: () => 'target-A',
        callback,
      });
      controller.hostConnected();
      vi.clearAllMocks();

      host.dispatchEvent(
        createMediaLoadedInfoEvent({
          info: createMediaLoadedInfo({ targetID: undefined }),
        }),
      );

      expect(callback).not.toBeCalled();
      expect(controller.get()).toBeNull();
    });
  });

  describe('hostConnected / hostDisconnected', () => {
    it('should add the listener on connect and remove + clear on disconnect', () => {
      const host = createLitElement();
      const controller = new MediaLoadedInfoSinkController(host, {
        getTargetID: () => 'target-1',
      });
      controller.hostConnected();

      const info = createMediaLoadedInfo({ targetID: 'target-1' });
      host.dispatchEvent(createMediaLoadedInfoEvent({ info }));
      expect(controller.get()).toBe(info);

      controller.hostDisconnected();
      expect(controller.has()).toBeFalsy();

      // Further events should not be observed.
      host.dispatchEvent(
        createMediaLoadedInfoEvent({
          info: createMediaLoadedInfo({ targetID: 'target-1', width: 500 }),
        }),
      );
      expect(controller.get()).toBeNull();
    });

    it('should not fire callback or requestUpdate on disconnect', () => {
      // Testing the asymmetry described in the controller's class doc: abort
      // path notifies consumers (host still rendering), disconnect path does
      // not (host detaching, no UI to update).
      const callback = vi.fn();
      const host = createLitElement();
      const controller = new MediaLoadedInfoSinkController(host, {
        getTargetID: () => 'target-1',
        callback,
      });
      controller.hostConnected();
      host.dispatchEvent(createMediaLoadedInfoEvent());
      vi.clearAllMocks();

      controller.hostDisconnected();

      expect(callback).not.toBeCalled();
      expect(host.requestUpdate).not.toBeCalled();
      expect(controller.get()).toBeNull();
    });
  });

  describe('on signal abort', () => {
    it('should clear the entry and fire callback(null) for the selected target', () => {
      const callback = vi.fn();
      const host = createLitElement();
      const controller = new MediaLoadedInfoSinkController(host, {
        getTargetID: () => 'target-A',
        callback,
      });
      controller.hostConnected();

      const ac = new AbortController();
      host.dispatchEvent(
        createMediaLoadedInfoEvent({
          info: createMediaLoadedInfo({ targetID: 'target-A' }),
          signal: ac.signal,
        }),
      );
      vi.clearAllMocks();

      ac.abort();

      expect(controller.get()).toBeNull();
      expect(callback).toBeCalledWith(null);
      expect(host.requestUpdate).toBeCalled();
    });

    it('should not fire callback when an unselected target aborts', () => {
      const callback = vi.fn();
      const host = createLitElement();
      const controller = new MediaLoadedInfoSinkController(host, {
        getTargetID: () => 'target-A',
        callback,
      });
      controller.hostConnected();

      const acA = new AbortController();
      const acB = new AbortController();
      host.dispatchEvent(
        createMediaLoadedInfoEvent({
          info: createMediaLoadedInfo({ targetID: 'target-A' }),
          signal: acA.signal,
        }),
      );
      host.dispatchEvent(
        createMediaLoadedInfoEvent({
          info: createMediaLoadedInfo({ targetID: 'target-B' }),
          signal: acB.signal,
        }),
      );
      vi.clearAllMocks();

      acB.abort();

      expect(callback).not.toBeCalled();
    });

    it('should not clobber a newer entry when an older signal aborts', () => {
      const host = createLitElement();
      const controller = new MediaLoadedInfoSinkController(host, {
        getTargetID: () => 'target-A',
      });
      controller.hostConnected();

      const ac1 = new AbortController();
      const info1 = createMediaLoadedInfo({ targetID: 'target-A', width: 100 });
      host.dispatchEvent(
        createMediaLoadedInfoEvent({ info: info1, signal: ac1.signal }),
      );

      const ac2 = new AbortController();
      const info2 = createMediaLoadedInfo({ targetID: 'target-A', width: 200 });
      host.dispatchEvent(
        createMediaLoadedInfoEvent({ info: info2, signal: ac2.signal }),
      );
      expect(controller.get()).toBe(info2);

      // The first signal aborts after a newer entry has overwritten the cache;
      // the newer entry must survive.
      ac1.abort();

      expect(controller.get()).toBe(info2);
    });
  });
});
