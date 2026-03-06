import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CardController } from '../../src/card-controller/controller';
import { PIPManager } from '../../src/card-controller/pip-manager';
import { ConditionStateManager } from '../../src/conditions/state-manager';
import { MediaPlayerController } from '../../src/types';
import { createCardAPI, createMediaLoadedInfo, flushPromises } from '../test-utils';

const stubPIPSupported = (enabled = true): void => {
  Object.defineProperty(document, 'pictureInPictureEnabled', {
    value: enabled,
    writable: true,
    configurable: true,
  });
};

const stubPIPElement = (element: Element | null): void => {
  Object.defineProperty(document, 'pictureInPictureElement', {
    value: element,
    writable: true,
    configurable: true,
  });
};

const createVideoElement = (): HTMLVideoElement => {
  const video = document.createElement('video');
  video.requestPictureInPicture = vi.fn().mockResolvedValue({});
  return video;
};

const createMediaPlayerControllerWithPIP = (
  video: HTMLVideoElement,
): MediaPlayerController => {
  const controller = mock<MediaPlayerController>();
  controller.getPIPElement.mockReturnValue(video);
  return controller;
};

const setupWithVideo = (api: CardController) => {
  const stateManager = new ConditionStateManager();
  vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

  const manager = new PIPManager(api);
  manager.initialize();

  const video = createVideoElement();
  stateManager.setState({
    mediaLoadedInfo: createMediaLoadedInfo({
      mediaPlayerController: createMediaPlayerControllerWithPIP(video),
    }),
  });

  return { manager, stateManager, video };
};

// @vitest-environment jsdom
describe('PIPManager', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();

    // Reset document PIP properties.
    Object.defineProperty(document, 'pictureInPictureEnabled', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(document, 'pictureInPictureElement', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  describe('isSupported', () => {
    it('returns true when pictureInPictureEnabled is true', () => {
      stubPIPSupported(true);

      expect(PIPManager.isSupported()).toBe(true);
    });

    it('returns false when pictureInPictureEnabled is falsy', () => {
      expect(PIPManager.isSupported()).toBeFalsy();
    });
  });

  describe('initialize', () => {
    it('registers a listener with the condition state manager', () => {
      const api = createCardAPI();
      const manager = new PIPManager(api);

      manager.initialize();

      expect(api.getConditionStateManager().addListener).toBeCalledWith(
        expect.anything(),
      );
    });
  });

  describe('uninitialize', () => {
    it('removes the listener from the condition state manager', () => {
      const api = createCardAPI();
      const manager = new PIPManager(api);

      manager.uninitialize();

      expect(api.getConditionStateManager().removeListener).toBeCalledWith(
        expect.anything(),
      );
    });

    it('clears video element reference', () => {
      stubPIPSupported();
      const api = createCardAPI();
      const { manager } = setupWithVideo(api);

      expect(manager.isAvailable()).toBe(true);

      manager.uninitialize();

      expect(manager.isAvailable()).toBe(false);
    });

    it('removes event listeners from tracked video', () => {
      stubPIPSupported();
      const api = createCardAPI();
      const { manager, video } = setupWithVideo(api);
      const removeSpy = vi.spyOn(video, 'removeEventListener');

      manager.uninitialize();

      expect(removeSpy).toBeCalledWith('enterpictureinpicture', expect.any(Function));
      expect(removeSpy).toBeCalledWith('leavepictureinpicture', expect.any(Function));
    });
  });

  describe('isInPIP', () => {
    it('returns false when no video element is tracked', () => {
      const api = createCardAPI();
      const manager = new PIPManager(api);

      expect(manager.isInPIP()).toBe(false);
    });

    it('returns true when any element is in PIP', () => {
      const api = createCardAPI();
      const manager = new PIPManager(api);

      stubPIPElement(document.createElement('video'));

      expect(manager.isInPIP()).toBe(true);
    });
  });

  describe('isAvailable', () => {
    it('returns true when PIP is supported and a video is loaded', () => {
      stubPIPSupported();
      const api = createCardAPI();
      const { manager } = setupWithVideo(api);

      expect(manager.isAvailable()).toBe(true);
    });

    it('returns false when PIP is not supported', () => {
      const api = createCardAPI();
      const manager = new PIPManager(api);
      manager.initialize();

      expect(manager.isAvailable()).toBe(false);
    });

    it('returns false when no video is loaded', () => {
      stubPIPSupported();
      const api = createCardAPI();
      const manager = new PIPManager(api);
      manager.initialize();

      expect(manager.isAvailable()).toBe(false);
    });
  });

  describe('media element tracking', () => {
    it('tracks the video element from mediaLoadedInfo', () => {
      stubPIPSupported();
      const api = createCardAPI();
      const { manager } = setupWithVideo(api);

      expect(manager.isAvailable()).toBe(true);
      expect(api.getCardElementManager().update).toBeCalled();
    });

    it('removes listeners when the media element changes', () => {
      stubPIPSupported();
      const api = createCardAPI();
      const { stateManager, video } = setupWithVideo(api);
      const removeSpy = vi.spyOn(video, 'removeEventListener');

      const video2 = createVideoElement();
      stateManager.setState({
        mediaLoadedInfo: createMediaLoadedInfo({
          mediaPlayerController: createMediaPlayerControllerWithPIP(video2),
        }),
      });

      expect(removeSpy).toBeCalledWith('enterpictureinpicture', expect.any(Function));
      expect(removeSpy).toBeCalledWith('leavepictureinpicture', expect.any(Function));
    });

    it('does not re-track when element is unchanged', () => {
      stubPIPSupported();
      const api = createCardAPI();
      const { stateManager, video } = setupWithVideo(api);
      const addSpy = vi.spyOn(video, 'addEventListener');
      addSpy.mockClear();

      stateManager.setState({ interaction: true });

      expect(addSpy).not.toBeCalledWith('enterpictureinpicture', expect.any(Function));
    });

    it('clears video element when media is unloaded', () => {
      stubPIPSupported();
      const api = createCardAPI();
      const { manager, stateManager } = setupWithVideo(api);

      expect(manager.isAvailable()).toBe(true);

      stateManager.setState({
        mediaLoadedInfo: createMediaLoadedInfo(),
      });

      expect(manager.isAvailable()).toBe(false);
    });

    it('exits PIP when the video element is destroyed', () => {
      stubPIPSupported();
      const api = createCardAPI();
      const { stateManager, video } = setupWithVideo(api);

      stubPIPElement(video);
      const exitPIP = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(document, 'exitPictureInPicture', {
        value: exitPIP,
        writable: true,
        configurable: true,
      });

      stateManager.setState({
        mediaLoadedInfo: createMediaLoadedInfo(),
      });

      expect(exitPIP).toBeCalled();
    });

    it('handles exitPictureInPicture rejection gracefully', async () => {
      stubPIPSupported();
      const api = createCardAPI();
      const { stateManager, video } = setupWithVideo(api);

      stubPIPElement(video);
      const exitPIP = vi.fn().mockRejectedValue(new Error('fail'));
      Object.defineProperty(document, 'exitPictureInPicture', {
        value: exitPIP,
        writable: true,
        configurable: true,
      });

      stateManager.setState({
        mediaLoadedInfo: createMediaLoadedInfo(),
      });

      expect(exitPIP).toBeCalled();

      // Ensure the rejection is caught and does not throw.
      await flushPromises();
    });

    it('does not exit PIP when video element changes to a new one', () => {
      stubPIPSupported();
      const api = createCardAPI();
      const { stateManager, video } = setupWithVideo(api);

      stubPIPElement(video);
      const exitPIP = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(document, 'exitPictureInPicture', {
        value: exitPIP,
        writable: true,
        configurable: true,
      });

      const video2 = createVideoElement();
      stateManager.setState({
        mediaLoadedInfo: createMediaLoadedInfo({
          mediaPlayerController: createMediaPlayerControllerWithPIP(video2),
        }),
      });

      expect(exitPIP).not.toBeCalled();
    });
  });

  describe('native PIP detection', () => {
    it('updates card when native PIP is entered', () => {
      stubPIPSupported();
      const api = createCardAPI();
      const { manager, video } = setupWithVideo(api);

      stubPIPElement(video);
      video.dispatchEvent(new Event('enterpictureinpicture'));

      expect(manager.isInPIP()).toBe(true);
      expect(api.getCardElementManager().update).toBeCalled();
    });

    it('updates card when PIP is exited via leavepictureinpicture', () => {
      stubPIPSupported();
      const api = createCardAPI();
      const { manager, video } = setupWithVideo(api);

      stubPIPElement(video);
      video.dispatchEvent(new Event('enterpictureinpicture'));
      expect(manager.isInPIP()).toBe(true);

      stubPIPElement(null);
      video.dispatchEvent(new Event('leavepictureinpicture'));

      expect(manager.isInPIP()).toBe(false);
    });
  });

  describe('togglePIP', () => {
    it('enters PIP when a video is available', async () => {
      stubPIPSupported();
      const api = createCardAPI();
      const { manager, video } = setupWithVideo(api);

      await manager.togglePIP();

      expect(video.requestPictureInPicture).toBeCalled();
    });

    it('exits PIP when currently in PIP', async () => {
      stubPIPSupported();
      const api = createCardAPI();
      const { manager, video } = setupWithVideo(api);

      stubPIPElement(video);
      Object.defineProperty(document, 'exitPictureInPicture', {
        value: vi.fn().mockResolvedValue(undefined),
        writable: true,
        configurable: true,
      });

      await manager.togglePIP();

      expect(document.exitPictureInPicture).toBeCalled();
      expect(video.requestPictureInPicture).not.toBeCalled();
    });

    it('does not enter PIP when no video is available', async () => {
      const api = createCardAPI();
      const manager = new PIPManager(api);

      await manager.togglePIP();

      expect(api.getCardElementManager().update).not.toBeCalled();
    });
  });
});
