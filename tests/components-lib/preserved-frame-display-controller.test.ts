import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { PreservedFrameManager } from '../../src/card-controller/preserved-frame-manager';
import { PreservedFrameDisplayController } from '../../src/components-lib/preserved-frame-display-controller';
import type { PreservedFrame } from '../../src/utils/preserved-frame-store';
import { createLitElement } from '../test-utils';
import { createPreservedFrame } from '../utils/test-utils';

const date = new Date('2026-11-17T12:00:00');

// A manager holding `frame` for every camera, which expires in 60 seconds.
const createManager = (frame: PreservedFrame | null = createPreservedFrame()) => {
  const manager = mock<PreservedFrameManager>();
  manager.get.mockReturnValue(frame);
  manager.getSecondsUntilExpired.mockReturnValue(60);
  manager.subscribe.mockReturnValue(vi.fn());
  return manager;
};

interface ControllerState {
  cameraID: string | null;
  manager: PreservedFrameManager | null;
  shownURL: string | null;
}

const createController = (options?: Partial<ControllerState>) => {
  const state: ControllerState = {
    cameraID: 'camera-1',
    manager: createManager(),
    shownURL: 'data:image/jpeg;base64,frame',
    ...options,
  };
  const host = createLitElement();
  const onShownFrameOutdated = vi.fn();
  const controller = new PreservedFrameDisplayController(host, {
    getCameraID: () => state.cameraID,
    getManager: () => state.manager,
    getShownURL: () => state.shownURL,
    onShownFrameOutdated,
  });
  return { host, controller, state, onShownFrameOutdated };
};

// @vitest-environment jsdom
describe('PreservedFrameDisplayController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(date);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should register itself with the host', () => {
    const { host, controller } = createController();

    expect(host.addController).toHaveBeenCalledWith(controller);
  });

  describe('should get the preserved frame', () => {
    it('should return the frame of the camera', () => {
      const frame = createPreservedFrame();
      const manager = createManager(frame);
      const { controller } = createController({ manager });

      expect(controller.getPreservedFrame()).toBe(frame);
      expect(manager.get).toHaveBeenCalledWith('camera-1');
    });

    it('should return null without a camera', () => {
      const { controller } = createController({ cameraID: null });

      expect(controller.getPreservedFrame()).toBeNull();
    });

    it('should return null without a manager', () => {
      const { controller } = createController({ manager: null });

      expect(controller.getPreservedFrame()).toBeNull();
    });

    it('should return null when the camera has no frame', () => {
      const { controller } = createController({ manager: createManager(null) });

      expect(controller.getPreservedFrame()).toBeNull();
    });
  });

  describe('should dismiss the preserved frame', () => {
    it('should return null once the host dismisses the frame', () => {
      const { controller } = createController();

      controller.dismiss();

      expect(controller.getPreservedFrame()).toBeNull();
    });

    it('should return a frame captured after the host dismissed the last one', () => {
      const manager = createManager();
      const { controller } = createController({ manager });
      controller.dismiss();

      vi.advanceTimersByTime(1000);
      const frame = createPreservedFrame();
      manager.get.mockReturnValue(frame);

      expect(controller.getPreservedFrame()).toBe(frame);
    });

    it('should not return the dismissed frame after the host reconnects', () => {
      const { controller } = createController();
      controller.dismiss();

      controller.hostDisconnected();

      expect(controller.getPreservedFrame()).toBeNull();
    });
  });

  describe('should tell the manager while the host shows the frame', () => {
    it('should not report a shown frame before the host updates', () => {
      const { controller } = createController();

      expect(controller.isShowingPreservedFrame()).toBe(false);
    });

    it('should tell the manager when the host shows the frame', () => {
      const frame = createPreservedFrame();
      const manager = createManager(frame);
      const { controller } = createController({ manager });

      controller.hostUpdated();

      expect(controller.isShowingPreservedFrame()).toBe(true);
      expect(manager.setShowing).toHaveBeenCalledWith(
        'camera-1',
        frame,
        expect.any(AbortSignal),
      );
    });

    it('should tell the manager only once while the host keeps showing the frame', () => {
      const manager = createManager();
      const { controller } = createController({ manager });

      controller.hostUpdated();
      controller.hostUpdated();

      expect(manager.setShowing).toHaveBeenCalledTimes(1);
    });

    it('should not tell the manager when the host shows a different image', () => {
      const manager = createManager();
      const { controller } = createController({
        manager,
        shownURL: 'https://example.com/snapshot.jpg',
      });

      controller.hostUpdated();

      expect(controller.isShowingPreservedFrame()).toBe(false);
      expect(manager.setShowing).not.toHaveBeenCalled();
    });

    it('should not tell the manager when the camera has no frame', () => {
      const manager = createManager(null);
      const { controller } = createController({ manager });

      controller.hostUpdated();

      expect(manager.setShowing).not.toHaveBeenCalled();
    });

    it('should abort the signal when the host stops showing the frame', () => {
      const manager = createManager();
      const { controller, state } = createController({ manager });
      controller.hostUpdated();
      const signal = manager.setShowing.mock.calls[0][2];

      state.shownURL = 'https://example.com/snapshot.jpg';
      controller.hostUpdated();

      expect(signal.aborted).toBe(true);
      expect(controller.isShowingPreservedFrame()).toBe(false);
    });

    it('should abort the signal when the host disconnects', () => {
      const manager = createManager();
      const { controller } = createController({ manager });
      controller.hostUpdated();
      const signal = manager.setShowing.mock.calls[0][2];

      controller.hostDisconnected();

      expect(signal.aborted).toBe(true);
      expect(controller.isShowingPreservedFrame()).toBe(false);
    });

    it('should tell the manager again after the host reconnects', () => {
      const manager = createManager();
      const { controller } = createController({ manager });
      controller.hostUpdated();
      controller.hostDisconnected();

      controller.hostUpdated();

      expect(manager.setShowing).toHaveBeenCalledTimes(2);
      expect(manager.setShowing.mock.calls[1][2].aborted).toBe(false);
    });

    it('should tell the manager about the new frame when the camera has a new frame', () => {
      const manager = createManager();
      const { controller, state } = createController({ manager });
      controller.hostUpdated();
      const signal = manager.setShowing.mock.calls[0][2];

      const replacement = createPreservedFrame({
        url: 'data:image/jpeg;base64,replacement',
      });
      manager.get.mockReturnValue(replacement);
      state.shownURL = replacement.url;
      controller.hostUpdated();

      expect(signal.aborted).toBe(true);
      expect(manager.setShowing).toHaveBeenLastCalledWith(
        'camera-1',
        replacement,
        expect.any(AbortSignal),
      );
    });
  });

  describe('should tell the host when the shown frame expires', () => {
    it('should tell the host once the frame expires', () => {
      const { controller, onShownFrameOutdated } = createController();
      controller.hostUpdated();

      vi.advanceTimersByTime(59 * 1000);
      expect(onShownFrameOutdated).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);
      expect(onShownFrameOutdated).toHaveBeenCalledTimes(1);
    });

    it('should tell the host at the new time when the expiry time of the frame changes', () => {
      const manager = createManager();
      const { controller, onShownFrameOutdated } = createController({ manager });
      controller.hostUpdated();

      manager.getSecondsUntilExpired.mockReturnValue(10);
      controller.hostUpdated();
      vi.advanceTimersByTime(10 * 1000);

      expect(onShownFrameOutdated).toHaveBeenCalledTimes(1);
    });

    it('should not tell the host when the host does not show the frame', () => {
      const { controller, onShownFrameOutdated } = createController({
        shownURL: 'https://example.com/snapshot.jpg',
      });
      controller.hostUpdated();

      vi.advanceTimersByTime(60 * 1000);

      expect(onShownFrameOutdated).not.toHaveBeenCalled();
    });

    it('should not tell the host after the host stops showing the frame', () => {
      const { controller, state, onShownFrameOutdated } = createController();
      controller.hostUpdated();

      state.shownURL = 'https://example.com/snapshot.jpg';
      controller.hostUpdated();
      vi.advanceTimersByTime(60 * 1000);

      expect(onShownFrameOutdated).not.toHaveBeenCalled();
    });

    it('should not tell the host after the host disconnects', () => {
      const { controller, onShownFrameOutdated } = createController();
      controller.hostUpdated();

      controller.hostDisconnected();
      vi.advanceTimersByTime(60 * 1000);

      expect(onShownFrameOutdated).not.toHaveBeenCalled();
    });
  });

  describe('should tell the host when a new frame is preserved', () => {
    it('should tell the host while it shows a frame of the camera', () => {
      const manager = createManager();
      const { controller, onShownFrameOutdated } = createController({ manager });
      controller.hostUpdated();

      expect(manager.subscribe).toHaveBeenCalledWith('camera-1', expect.any(Function));
      manager.subscribe.mock.calls[0][1]();

      expect(onShownFrameOutdated).toHaveBeenCalledTimes(1);
    });

    it('should not listen while the host does not show the frame', () => {
      const manager = createManager();
      const { controller } = createController({
        manager,
        shownURL: 'https://example.com/snapshot.jpg',
      });

      controller.hostUpdated();

      expect(manager.subscribe).not.toHaveBeenCalled();
    });

    it('should stop listening once the host stops showing the frame', () => {
      const manager = createManager();
      const unsubscribe = vi.fn();
      manager.subscribe.mockReturnValue(unsubscribe);
      const { controller, state } = createController({ manager });
      controller.hostUpdated();

      state.shownURL = 'https://example.com/snapshot.jpg';
      controller.hostUpdated();

      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('should stop listening once the host disconnects', () => {
      const manager = createManager();
      const unsubscribe = vi.fn();
      manager.subscribe.mockReturnValue(unsubscribe);
      const { controller } = createController({ manager });
      controller.hostUpdated();

      controller.hostDisconnected();

      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
  });
});
