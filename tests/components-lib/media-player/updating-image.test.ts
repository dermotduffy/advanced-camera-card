import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CachedValueController } from '../../../src/components-lib/cached-value-controller';
import { ImageMediaPlayerController } from '../../../src/components-lib/media-player/image';
import { UpdatingImageMediaPlayerController } from '../../../src/components-lib/media-player/updating-image';
import { createLitElement } from '../../test-utils';

// @vitest-environment jsdom
describe('UpdatingImageMediaPlayerController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should play', async () => {
    const cachedValueController = mock<CachedValueController<string>>();
    const controller = new UpdatingImageMediaPlayerController(
      createLitElement(),
      () => mock<HTMLImageElement>(),
      () => cachedValueController,
    );

    await controller.play();

    expect(cachedValueController.startTimer).toHaveBeenCalled();
  });

  it('should pause', async () => {
    const cachedValueController = mock<CachedValueController<string>>();
    const controller = new UpdatingImageMediaPlayerController(
      createLitElement(),
      () => mock<HTMLImageElement>(),
      () => cachedValueController,
    );

    await controller.pause();

    expect(cachedValueController.stopTimer).toHaveBeenCalled();
  });

  it('should ignore mute', async () => {
    const controller = new UpdatingImageMediaPlayerController(
      createLitElement(),
      () => mock<HTMLImageElement>(),
      () => mock<CachedValueController<string>>(),
    );

    await controller.mute();

    // Currently no observable side effects.
  });

  it('should ignore unmute', async () => {
    const controller = new UpdatingImageMediaPlayerController(
      createLitElement(),
      () => mock<HTMLImageElement>(),
      () => mock<CachedValueController<string>>(),
    );

    await controller.unmute();

    // Currently no observable side effects.
  });

  it('should always report muted', () => {
    const controller = new UpdatingImageMediaPlayerController(
      createLitElement(),
      () => mock<HTMLImageElement>(),
      () => mock<CachedValueController<string>>(),
    );

    expect(controller.isMuted()).toBeTruthy();
  });

  it('should ignore seek', async () => {
    const controller = new UpdatingImageMediaPlayerController(
      createLitElement(),
      () => mock<HTMLImageElement>(),
      () => mock<CachedValueController<string>>(),
    );

    await controller.seek(10);

    // Currently no observable side effects.
  });

  it('should ignore set controls', async () => {
    const controller = new UpdatingImageMediaPlayerController(
      createLitElement(),
      () => mock<HTMLImageElement>(),
      () => mock<CachedValueController<string>>(),
    );

    await controller.setControls(true);

    // Currently no observable side effects.
  });

  it('should always report unpaused', () => {
    const image = mock<HTMLImageElement>();
    const controller = new ImageMediaPlayerController(createLitElement(), () => image);

    expect(controller.isPaused()).toBeFalsy();
  });

  describe('should get paused state', () => {
    it('should return true when the cached value controller does not have a timer', () => {
      const cachedValueController = mock<CachedValueController<string>>();
      cachedValueController.hasTimer.mockReturnValue(false);

      const controller = new UpdatingImageMediaPlayerController(
        createLitElement(),
        () => mock<HTMLImageElement>(),
        () => cachedValueController,
      );

      expect(controller.isPaused()).toBeTruthy();
    });

    it('should return false when the cached value controller has a timer', () => {
      const cachedValueController = mock<CachedValueController<string>>();
      cachedValueController.hasTimer.mockReturnValue(true);

      const controller = new UpdatingImageMediaPlayerController(
        createLitElement(),
        () => mock<HTMLImageElement>(),
        () => cachedValueController,
      );

      expect(controller.isPaused()).toBeFalsy();
    });

    it('should return true without cached value controller', () => {
      const controller = new UpdatingImageMediaPlayerController(
        createLitElement(),
        () => mock<HTMLImageElement>(),
        () => null,
      );

      expect(controller.isPaused()).toBeTruthy();
    });
  });

  describe('should get screenshot URL', () => {
    it('should return screenshot URL with cached value controller', async () => {
      const url = 'data:image/png;base64,';
      const cachedValueController = mock<CachedValueController<string>>();
      Object.defineProperty(cachedValueController, 'value', { value: url });

      const controller = new UpdatingImageMediaPlayerController(
        createLitElement(),
        () => mock<HTMLImageElement>(),
        () => cachedValueController,
      );

      expect(await controller.getScreenshotURL()).toBe(url);
    });

    it('should return null without cached value controller', async () => {
      const controller = new UpdatingImageMediaPlayerController(
        createLitElement(),
        () => mock<HTMLImageElement>(),
        () => null,
      );

      expect(await controller.getScreenshotURL()).toBeNull();
    });
  });

  describe('should get fullscreen element', async () => {
    it('should return fullscreen element with image', async () => {
      const image = mock<HTMLImageElement>();

      const controller = new UpdatingImageMediaPlayerController(
        createLitElement(),
        () => image,
        () => mock<CachedValueController<string>>(),
      );

      expect(await controller.getFullscreenElement()).toBe(image);
    });

    it('should return null without image', async () => {
      const controller = new UpdatingImageMediaPlayerController(
        createLitElement(),
        () => null,
        () => mock<CachedValueController<string>>(),
      );

      expect(controller.getFullscreenElement()).toBeNull();
    });
  });
});
