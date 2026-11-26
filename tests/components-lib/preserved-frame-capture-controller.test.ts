import { assert, describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { PreservedFrameManager } from '../../src/card-controller/preserved-frame-manager';
import { PreservedFrameCaptureController } from '../../src/components-lib/preserved-frame-capture-controller';
import type { MediaLoadedInfo, MediaPlayerController } from '../../src/types';
import {
  changeDocumentVisibility,
  createDocumentVisibility,
  createLitElement,
  createMediaLoadedInfo,
  createMediaLoadedInfoEvent,
} from '../test-utils';

const createManager = () => {
  const manager = mock<PreservedFrameManager>();
  manager.capture.mockResolvedValue();
  return manager;
};

const createController = (options?: {
  manager?: PreservedFrameManager | null;
  mediaLoadedInfo?: MediaLoadedInfo | null;
}) => {
  const host = createLitElement();
  const documentVisibility = createDocumentVisibility();
  const controller = new PreservedFrameCaptureController(host, {
    getManager: () => options?.manager ?? null,
    getMediaLoadedInfo: () => options?.mediaLoadedInfo ?? null,
    documentVisibility,
  });
  return { host, controller, documentVisibility };
};

// @vitest-environment jsdom
describe('PreservedFrameCaptureController', () => {
  it('should register itself with the host', () => {
    const { host, controller } = createController();

    expect(host.addController).toHaveBeenCalledWith(controller);
  });

  describe('should capture when media unloads', () => {
    it('should capture a frame for the camera once its media unloads', () => {
      const manager = createManager();
      const { host } = createController({ manager });
      const player = mock<MediaPlayerController>();
      const abortController = new AbortController();

      host.dispatchEvent(
        createMediaLoadedInfoEvent({
          info: createMediaLoadedInfo({
            targetID: 'camera-1',
            mediaPlayerController: player,
          }),
          signal: abortController.signal,
        }),
      );
      expect(manager.capture).not.toHaveBeenCalled();

      abortController.abort();

      expect(manager.capture).toHaveBeenCalledWith('camera-1', player);
    });

    it('should capture media that unloads after the host disconnects', () => {
      const manager = createManager();
      const { host, controller } = createController({ manager });
      const player = mock<MediaPlayerController>();
      const abortController = new AbortController();
      controller.hostConnected();
      host.dispatchEvent(
        createMediaLoadedInfoEvent({
          info: createMediaLoadedInfo({
            targetID: 'camera-1',
            mediaPlayerController: player,
          }),
          signal: abortController.signal,
        }),
      );

      controller.hostDisconnected();
      abortController.abort();

      expect(manager.capture).toHaveBeenCalledWith('camera-1', player);
    });

    it('should not capture media without a player', () => {
      const manager = createManager();
      const { host } = createController({ manager });
      const abortController = new AbortController();
      host.dispatchEvent(
        createMediaLoadedInfoEvent({
          info: createMediaLoadedInfo({ targetID: 'camera-1' }),
          signal: abortController.signal,
        }),
      );

      abortController.abort();

      expect(manager.capture).not.toHaveBeenCalled();
    });

    it('should not capture media without a camera', () => {
      const manager = createManager();
      const { host } = createController({ manager });
      const abortController = new AbortController();
      host.dispatchEvent(
        createMediaLoadedInfoEvent({
          info: createMediaLoadedInfo({
            targetID: undefined,
            mediaPlayerController: mock<MediaPlayerController>(),
          }),
          signal: abortController.signal,
        }),
      );

      abortController.abort();

      expect(manager.capture).not.toHaveBeenCalled();
    });

    it('should do nothing without a manager', () => {
      const { host } = createController();
      const abortController = new AbortController();
      host.dispatchEvent(
        createMediaLoadedInfoEvent({
          info: createMediaLoadedInfo({
            mediaPlayerController: mock<MediaPlayerController>(),
          }),
          signal: abortController.signal,
        }),
      );

      expect(() => abortController.abort()).not.toThrow();
    });

    it('should ignore a failed capture', async () => {
      const manager = createManager();
      manager.capture.mockRejectedValue(new Error('capture failed'));
      const { host } = createController({ manager });
      const abortController = new AbortController();
      host.dispatchEvent(
        createMediaLoadedInfoEvent({
          info: createMediaLoadedInfo({
            mediaPlayerController: mock<MediaPlayerController>(),
          }),
          signal: abortController.signal,
        }),
      );

      abortController.abort();

      await expect(manager.capture.mock.results[0].value).rejects.toThrow();
    });
  });

  describe('should capture when the page is hidden', () => {
    it('should capture the loaded media', async () => {
      const manager = createManager();
      const player = mock<MediaPlayerController>();
      const { controller, documentVisibility } = createController({
        manager,
        mediaLoadedInfo: createMediaLoadedInfo({
          targetID: 'camera-1',
          mediaPlayerController: player,
        }),
      });
      controller.hostConnected();

      await changeDocumentVisibility(documentVisibility, false);

      expect(manager.capture).toHaveBeenCalledWith('camera-1', player);
    });

    it('should not capture when the page becomes visible', async () => {
      const manager = createManager();
      const { controller, documentVisibility } = createController({
        manager,
        mediaLoadedInfo: createMediaLoadedInfo({
          mediaPlayerController: mock<MediaPlayerController>(),
        }),
      });
      controller.hostConnected();

      await changeDocumentVisibility(documentVisibility, true);

      expect(manager.capture).not.toHaveBeenCalled();
    });

    it('should not capture when no media is loaded', async () => {
      const manager = createManager();
      const { controller, documentVisibility } = createController({ manager });
      controller.hostConnected();

      await changeDocumentVisibility(documentVisibility, false);

      expect(manager.capture).not.toHaveBeenCalled();
    });

    it('should stop watching the page once the host disconnects', () => {
      const { controller, documentVisibility } = createController();
      controller.hostConnected();
      const result = documentVisibility.subscribe.mock.results[0];
      assert(result.type === 'return');
      expect(result.value).not.toHaveBeenCalled();

      controller.hostDisconnected();

      expect(result.value).toHaveBeenCalledTimes(1);
    });

    it('should not throw when the host disconnects before it connects', () => {
      const { controller } = createController();

      expect(() => controller.hostDisconnected()).not.toThrow();
    });

    it('should use the shared document visibility by default', () => {
      const controller = new PreservedFrameCaptureController(createLitElement(), {
        getManager: () => null,
        getMediaLoadedInfo: () => null,
      });

      expect(() => {
        controller.hostConnected();
        controller.hostDisconnected();
      }).not.toThrow();
    });
  });
});
