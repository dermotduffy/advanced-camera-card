import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { ImageMediaPlayerController } from '../../../src/components-lib/media-player/image';
import { createLitElement } from '../../test-utils';
import { screenshotImage } from '../../../src/utils/screenshot';

vi.mock('../../../src/utils/screenshot.js');

// @vitest-environment jsdom
describe('ImageMediaPlayerController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should ignore play', async () => {
    const image = mock<HTMLImageElement>();
    const controller = new ImageMediaPlayerController(createLitElement(), () => image);

    await controller.play();

    // Currently no observable side effects.
  });

  it('should ignore pause', async () => {
    const image = mock<HTMLImageElement>();
    const controller = new ImageMediaPlayerController(createLitElement(), () => image);

    await controller.pause();

    // Currently no observable side effects.
  });

  it('should ignore mute', async () => {
    const image = mock<HTMLImageElement>();
    const controller = new ImageMediaPlayerController(createLitElement(), () => image);

    await controller.mute();

    // Currently no observable side effects.
  });

  it('should ignore unmute', async () => {
    const image = mock<HTMLImageElement>();
    const controller = new ImageMediaPlayerController(createLitElement(), () => image);

    await controller.unmute();

    // Currently no observable side effects.
  });

  it('should always report muted', () => {
    const image = mock<HTMLImageElement>();
    const controller = new ImageMediaPlayerController(createLitElement(), () => image);

    expect(controller.isMuted()).toBeTruthy();
  });

  it('should ignore seek', async () => {
    const image = mock<HTMLImageElement>();
    const controller = new ImageMediaPlayerController(createLitElement(), () => image);

    await controller.seek(10);

    // Currently no observable side effects.
  });

  it('should ignore set controls', async () => {
    const image = mock<HTMLImageElement>();
    const controller = new ImageMediaPlayerController(createLitElement(), () => image);

    await controller.setControls(true);

    // Currently no observable side effects.
  });

  it('should always report unpaused', () => {
    const image = mock<HTMLImageElement>();
    const controller = new ImageMediaPlayerController(createLitElement(), () => image);

    expect(controller.isPaused()).toBeFalsy();
  });

  describe('should get screenshot URL', async () => {
    it('should return screenshot URL with image', async () => {
      const url = 'data:image/png;base64,';
      vi.mocked(screenshotImage).mockReturnValue(url);

      const image = mock<HTMLImageElement>();

      const controller = new ImageMediaPlayerController(createLitElement(), () => image);

      expect(await controller.getScreenshotURL()).toBe(url);
    });

    it('should return null without image', async () => {
      const controller = new ImageMediaPlayerController(createLitElement(), () => null);

      expect(await controller.getScreenshotURL()).toBeNull();
    });
  });

  describe('should get fullscreen element', async () => {
    it('should return fullscreen element with image', async () => {
      const image = mock<HTMLImageElement>();

      const controller = new ImageMediaPlayerController(createLitElement(), () => image);

      expect(await controller.getFullscreenElement()).toBe(image);
    });

    it('should return null without image', async () => {
      const controller = new ImageMediaPlayerController(createLitElement(), () => null);

      expect(controller.getFullscreenElement()).toBeNull();
    });
  });
});
