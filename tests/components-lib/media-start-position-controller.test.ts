import type { ReactiveControllerHost } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { CameraManager } from '../../src/camera-manager/manager';
import { MediaStartPositionController } from '../../src/components-lib/media-start-position-controller';
import type { View } from '../../src/view/view';
import { createView, TestViewMedia } from '../view/test-utils';

const START = new Date('2024-01-01T10:00:00');
const END = new Date('2024-01-01T11:00:00');

const createMedia = (contentID = 'content-id'): TestViewMedia =>
  new TestViewMedia({ startTime: START, endTime: END, contentID: contentID });

const createSeekView = (seek: Date): View =>
  createView({ context: { mediaViewer: { seek: seek } } });

describe('MediaStartPositionController', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should register itself with the host', () => {
    const host = mock<ReactiveControllerHost>();
    const controller = new MediaStartPositionController(host, () => ({}));

    expect(host.addController).toHaveBeenCalledWith(controller);
    expect(controller.getValue()).toBeNull();
    expect(controller.hasResolved()).toBe(false);
  });

  it('should compute the start position and request a host update', async () => {
    const host = mock<ReactiveControllerHost>();
    const cameraManager = mock<CameraManager>();
    cameraManager.getMediaSeekTime.mockResolvedValue(1800);
    const media = createMedia();
    const seek = new Date('2024-01-01T10:30:00');

    const controller = new MediaStartPositionController(host, () => ({
      cameraManager: cameraManager,
      view: createSeekView(seek),
      media: media,
    }));

    await controller.hostUpdate();

    expect(cameraManager.getMediaSeekTime).toHaveBeenCalledWith(media, seek);
    expect(controller.getValue()).toBe(1800);
    expect(controller.hasResolved()).toBe(true);
    expect(host.requestUpdate).toHaveBeenCalled();
  });

  it('should start from the playback start time without a view', async () => {
    const cameraManager = mock<CameraManager>();
    cameraManager.getMediaSeekTime.mockResolvedValue(0);
    const media = createMedia();

    const controller = new MediaStartPositionController(
      mock<ReactiveControllerHost>(),
      () => ({
        cameraManager: cameraManager,
        media: media,
      }),
    );

    await controller.hostUpdate();

    expect(cameraManager.getMediaSeekTime).toHaveBeenCalledWith(media, START);
    expect(controller.getValue()).toBe(0);
  });

  describe('should not compute a start position', () => {
    it('without media', async () => {
      const cameraManager = mock<CameraManager>();
      const controller = new MediaStartPositionController(
        mock<ReactiveControllerHost>(),
        () => ({ cameraManager: cameraManager, media: null }),
      );

      await controller.hostUpdate();

      expect(cameraManager.getMediaSeekTime).not.toHaveBeenCalled();
      expect(controller.hasResolved()).toBe(false);
    });

    it('without media content', async () => {
      const cameraManager = mock<CameraManager>();
      const controller = new MediaStartPositionController(
        mock<ReactiveControllerHost>(),
        () => ({
          cameraManager: cameraManager,
          media: new TestViewMedia({ startTime: START, endTime: END }),
        }),
      );

      await controller.hostUpdate();

      expect(cameraManager.getMediaSeekTime).not.toHaveBeenCalled();
      expect(controller.hasResolved()).toBe(false);
    });
  });

  describe('should resolve to start from the beginning', () => {
    it('without a camera manager', async () => {
      const controller = new MediaStartPositionController(
        mock<ReactiveControllerHost>(),
        () => ({ media: createMedia() }),
      );

      await controller.hostUpdate();

      expect(controller.getValue()).toBeNull();
      expect(controller.hasResolved()).toBe(true);
    });

    it('when the requested seek is outside the media', async () => {
      const cameraManager = mock<CameraManager>();
      const controller = new MediaStartPositionController(
        mock<ReactiveControllerHost>(),
        () => ({
          cameraManager: cameraManager,
          view: createSeekView(new Date('2024-01-01T12:00:00')),
          media: createMedia(),
        }),
      );

      await controller.hostUpdate();

      expect(cameraManager.getMediaSeekTime).not.toHaveBeenCalled();
      expect(controller.getValue()).toBeNull();
      expect(controller.hasResolved()).toBe(true);
    });

    it('when the media has no seek target', async () => {
      const cameraManager = mock<CameraManager>();
      const controller = new MediaStartPositionController(
        mock<ReactiveControllerHost>(),
        () => ({
          cameraManager: cameraManager,
          media: new TestViewMedia({ contentID: 'content-id' }),
        }),
      );

      await controller.hostUpdate();

      expect(cameraManager.getMediaSeekTime).not.toHaveBeenCalled();
      expect(controller.getValue()).toBeNull();
      expect(controller.hasResolved()).toBe(true);
    });

    it('when the seek time cannot be found', async () => {
      const cameraManager = mock<CameraManager>();
      cameraManager.getMediaSeekTime.mockResolvedValue(null);
      const controller = new MediaStartPositionController(
        mock<ReactiveControllerHost>(),
        () => ({ cameraManager: cameraManager, media: createMedia() }),
      );

      await controller.hostUpdate();

      expect(controller.getValue()).toBeNull();
      expect(controller.hasResolved()).toBe(true);
    });

    it('when the seek time lookup fails', async () => {
      const host = mock<ReactiveControllerHost>();
      const cameraManager = mock<CameraManager>();
      cameraManager.getMediaSeekTime.mockRejectedValue(new Error('error'));
      const controller = new MediaStartPositionController(host, () => ({
        cameraManager: cameraManager,
        media: createMedia(),
      }));

      await controller.hostUpdate();

      expect(controller.getValue()).toBeNull();
      expect(controller.hasResolved()).toBe(true);
      expect(host.requestUpdate).toHaveBeenCalled();
    });
  });

  it('should not recompute for the same media content', async () => {
    const cameraManager = mock<CameraManager>();
    cameraManager.getMediaSeekTime.mockResolvedValue(1800);
    let view = createSeekView(new Date('2024-01-01T10:30:00'));
    const controller = new MediaStartPositionController(
      mock<ReactiveControllerHost>(),
      () => ({ cameraManager: cameraManager, view: view, media: createMedia() }),
    );

    await controller.hostUpdate();

    // A later seek in the same media is left to the viewer.
    view = createSeekView(new Date('2024-01-01T10:45:00'));
    await controller.hostUpdate();

    expect(cameraManager.getMediaSeekTime).toHaveBeenCalledTimes(1);
    expect(controller.getValue()).toBe(1800);
    expect(controller.hasResolved()).toBe(true);
  });

  it('should recompute for different media content', async () => {
    const cameraManager = mock<CameraManager>();
    cameraManager.getMediaSeekTime.mockResolvedValueOnce(1800).mockResolvedValueOnce(60);
    let media = createMedia('content-1');
    const controller = new MediaStartPositionController(
      mock<ReactiveControllerHost>(),
      () => ({ cameraManager: cameraManager, media: media }),
    );

    await controller.hostUpdate();
    expect(controller.getValue()).toBe(1800);

    media = createMedia('content-2');
    await controller.hostUpdate();

    expect(cameraManager.getMediaSeekTime).toHaveBeenCalledTimes(2);
    expect(controller.getValue()).toBe(60);
  });

  it('should ignore a result for media content that has since changed', async () => {
    const host = mock<ReactiveControllerHost>();
    const cameraManager = mock<CameraManager>();
    let resolveFirst: ((value: number | null) => void) | undefined;
    cameraManager.getMediaSeekTime
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockResolvedValueOnce(60);
    let media = createMedia('content-1');
    const controller = new MediaStartPositionController(host, () => ({
      cameraManager: cameraManager,
      media: media,
    }));

    const firstUpdate = controller.hostUpdate();
    media = createMedia('content-2');
    await controller.hostUpdate();

    resolveFirst?.(1800);
    await firstUpdate;

    expect(controller.getValue()).toBe(60);
    expect(host.requestUpdate).toHaveBeenCalledTimes(1);
  });

  it('should ignore a result that arrives after the host disconnected', async () => {
    const host = mock<ReactiveControllerHost>();
    const cameraManager = mock<CameraManager>();
    let resolveSeek: ((value: number | null) => void) | undefined;
    cameraManager.getMediaSeekTime.mockReturnValue(
      new Promise((resolve) => {
        resolveSeek = resolve;
      }),
    );
    const controller = new MediaStartPositionController(host, () => ({
      cameraManager: cameraManager,
      media: createMedia(),
    }));

    const update = controller.hostUpdate();
    controller.hostDisconnected();

    resolveSeek?.(1800);
    await update;

    expect(controller.getValue()).toBeNull();
    expect(controller.hasResolved()).toBe(false);
    expect(host.requestUpdate).not.toHaveBeenCalled();
  });

  it('should reset when the media is cleared', async () => {
    const cameraManager = mock<CameraManager>();
    cameraManager.getMediaSeekTime.mockResolvedValue(1800);
    let media: TestViewMedia | null = createMedia();
    const controller = new MediaStartPositionController(
      mock<ReactiveControllerHost>(),
      () => ({ cameraManager: cameraManager, media: media }),
    );

    await controller.hostUpdate();
    expect(controller.hasResolved()).toBe(true);

    media = null;
    await controller.hostUpdate();

    expect(controller.getValue()).toBeNull();
    expect(controller.hasResolved()).toBe(false);
  });
});
