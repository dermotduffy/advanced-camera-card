import type { ReactiveControllerHost } from 'lit';
import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { ViewItemManager } from '../../src/card-controller/view/item-manager';
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
  it('should register itself with the host', () => {
    const host = mock<ReactiveControllerHost>();
    const controller = new MediaStartPositionController(host, () => ({}));

    expect(host.addController).toHaveBeenCalledWith(controller);
    expect(controller.getValue()).toBeNull();
    expect(controller.isPending()).toBe(false);
  });

  it('should compute the start position and request a host update', async () => {
    const host = mock<ReactiveControllerHost>();
    const viewItemManager = mock<ViewItemManager>();
    viewItemManager.getMediaSeekTime.mockResolvedValue(1800);
    const media = createMedia();
    const seek = new Date('2024-01-01T10:30:00');

    const controller = new MediaStartPositionController(host, () => ({
      viewItemManager,
      view: createSeekView(seek),
      media: media,
    }));

    await controller.hostUpdate();

    expect(viewItemManager.getMediaSeekTime).toHaveBeenCalledWith(media, seek);
    expect(controller.getValue()).toBe(1800);
    expect(controller.isPending()).toBe(false);
    expect(host.requestUpdate).toHaveBeenCalled();
  });

  it('should start from the playback start time without a view', async () => {
    const viewItemManager = mock<ViewItemManager>();
    viewItemManager.getMediaSeekTime.mockResolvedValue(0);
    const media = createMedia();

    const controller = new MediaStartPositionController(
      mock<ReactiveControllerHost>(),
      () => ({
        viewItemManager,
        media: media,
      }),
    );

    await controller.hostUpdate();

    expect(viewItemManager.getMediaSeekTime).toHaveBeenCalledWith(media, START);
    expect(controller.getValue()).toBe(0);
  });

  describe('should not compute a start position', () => {
    it('without media', async () => {
      const viewItemManager = mock<ViewItemManager>();
      const controller = new MediaStartPositionController(
        mock<ReactiveControllerHost>(),
        () => ({ viewItemManager }),
      );

      await controller.hostUpdate();

      expect(viewItemManager.getMediaSeekTime).not.toHaveBeenCalled();
      expect(controller.isPending()).toBe(false);
    });

    it('without media content', async () => {
      const viewItemManager = mock<ViewItemManager>();
      const controller = new MediaStartPositionController(
        mock<ReactiveControllerHost>(),
        () => ({
          viewItemManager,
          media: new TestViewMedia({ startTime: START, endTime: END }),
        }),
      );

      await controller.hostUpdate();

      expect(viewItemManager.getMediaSeekTime).not.toHaveBeenCalled();
      expect(controller.isPending()).toBe(false);
    });
  });

  describe('should resolve to start from the beginning', () => {
    it('without a view item manager', async () => {
      const controller = new MediaStartPositionController(
        mock<ReactiveControllerHost>(),
        () => ({ media: createMedia() }),
      );

      await controller.hostUpdate();

      expect(controller.getValue()).toBeNull();
      expect(controller.isPending()).toBe(false);
    });

    it('when the requested seek is outside the media', async () => {
      const viewItemManager = mock<ViewItemManager>();
      const controller = new MediaStartPositionController(
        mock<ReactiveControllerHost>(),
        () => ({
          viewItemManager,
          view: createSeekView(new Date('2024-01-01T12:00:00')),
          media: createMedia(),
        }),
      );

      await controller.hostUpdate();

      expect(viewItemManager.getMediaSeekTime).not.toHaveBeenCalled();
      expect(controller.getValue()).toBeNull();
      expect(controller.isPending()).toBe(false);
    });

    it('when the media has no seek target', async () => {
      const viewItemManager = mock<ViewItemManager>();
      const controller = new MediaStartPositionController(
        mock<ReactiveControllerHost>(),
        () => ({
          viewItemManager,
          media: new TestViewMedia({ contentID: 'content-id' }),
        }),
      );

      await controller.hostUpdate();

      expect(viewItemManager.getMediaSeekTime).not.toHaveBeenCalled();
      expect(controller.getValue()).toBeNull();
      expect(controller.isPending()).toBe(false);
    });

    it('when the seek time cannot be found', async () => {
      const viewItemManager = mock<ViewItemManager>();
      viewItemManager.getMediaSeekTime.mockResolvedValue(null);
      const controller = new MediaStartPositionController(
        mock<ReactiveControllerHost>(),
        () => ({ viewItemManager, media: createMedia() }),
      );

      await controller.hostUpdate();

      expect(controller.getValue()).toBeNull();
      expect(controller.isPending()).toBe(false);
    });

    it('when the seek time lookup fails', async () => {
      const host = mock<ReactiveControllerHost>();
      const viewItemManager = mock<ViewItemManager>();
      viewItemManager.getMediaSeekTime.mockRejectedValue(new Error('error'));
      const controller = new MediaStartPositionController(host, () => ({
        viewItemManager,
        media: createMedia(),
      }));

      await controller.hostUpdate();

      expect(controller.getValue()).toBeNull();
      expect(controller.isPending()).toBe(false);
      expect(host.requestUpdate).toHaveBeenCalled();
    });
  });

  it('should not recompute for the same media content', async () => {
    const viewItemManager = mock<ViewItemManager>();
    viewItemManager.getMediaSeekTime.mockResolvedValue(1800);
    let view = createSeekView(new Date('2024-01-01T10:30:00'));
    const controller = new MediaStartPositionController(
      mock<ReactiveControllerHost>(),
      () => ({ viewItemManager, view: view, media: createMedia() }),
    );

    await controller.hostUpdate();

    // A later seek in the same media is left to the carousel.
    view = createSeekView(new Date('2024-01-01T10:45:00'));
    await controller.hostUpdate();

    expect(viewItemManager.getMediaSeekTime).toHaveBeenCalledTimes(1);
    expect(controller.getValue()).toBe(1800);
    expect(controller.isPending()).toBe(false);
  });

  it('should recompute for different media content', async () => {
    const viewItemManager = mock<ViewItemManager>();
    viewItemManager.getMediaSeekTime
      .mockResolvedValueOnce(1800)
      .mockResolvedValueOnce(60);
    let media = createMedia('content-1');
    const controller = new MediaStartPositionController(
      mock<ReactiveControllerHost>(),
      () => ({ viewItemManager, media: media }),
    );

    await controller.hostUpdate();
    expect(controller.getValue()).toBe(1800);

    media = createMedia('content-2');
    await controller.hostUpdate();

    expect(viewItemManager.getMediaSeekTime).toHaveBeenCalledTimes(2);
    expect(controller.getValue()).toBe(60);
  });

  it('should ignore a result for media content that has since changed', async () => {
    const host = mock<ReactiveControllerHost>();
    const viewItemManager = mock<ViewItemManager>();
    let resolveFirst: ((value: number | null) => void) | undefined;
    viewItemManager.getMediaSeekTime
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockResolvedValueOnce(60);
    let media = createMedia('content-1');
    const controller = new MediaStartPositionController(host, () => ({
      viewItemManager,
      media: media,
    }));

    const firstUpdate = controller.hostUpdate();
    expect(controller.isPending()).toBe(true);
    media = createMedia('content-2');
    await controller.hostUpdate();

    resolveFirst?.(1800);
    await firstUpdate;

    expect(controller.getValue()).toBe(60);
    expect(host.requestUpdate).toHaveBeenCalledTimes(1);
  });

  it('should ignore a result that arrives after the host disconnected', async () => {
    const host = mock<ReactiveControllerHost>();
    const viewItemManager = mock<ViewItemManager>();
    let resolveSeek: ((value: number | null) => void) | undefined;
    viewItemManager.getMediaSeekTime.mockReturnValue(
      new Promise((resolve) => {
        resolveSeek = resolve;
      }),
    );
    const controller = new MediaStartPositionController(host, () => ({
      viewItemManager,
      media: createMedia(),
    }));

    const update = controller.hostUpdate();
    expect(controller.isPending()).toBe(true);
    controller.hostDisconnected();

    resolveSeek?.(1800);
    await update;

    expect(controller.getValue()).toBeNull();
    expect(controller.isPending()).toBe(false);
    expect(host.requestUpdate).not.toHaveBeenCalled();
  });

  it('should reset when the media is cleared', async () => {
    const viewItemManager = mock<ViewItemManager>();
    viewItemManager.getMediaSeekTime.mockResolvedValue(1800);
    let media: TestViewMedia | null = createMedia();
    const controller = new MediaStartPositionController(
      mock<ReactiveControllerHost>(),
      () => ({ viewItemManager, media: media ?? undefined }),
    );

    await controller.hostUpdate();
    expect(controller.isPending()).toBe(false);

    media = null;
    await controller.hostUpdate();

    expect(controller.getValue()).toBeNull();
    expect(controller.isPending()).toBe(false);
  });
});
