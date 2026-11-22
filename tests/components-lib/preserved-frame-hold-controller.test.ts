import type { ReactiveControllerHost } from 'lit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import {
  PRESERVED_FRAME_HOLD_MAX_SECONDS,
  PreservedFrameHoldController,
} from '../../src/components-lib/preserved-frame-hold-controller';
import type { MediaLoadedInfo, MediaPlayerController } from '../../src/types';
import { waitForPaint } from '../../src/utils/wait-for-paint';
import { createLitElement, flushPromises } from '../test-utils';

vi.mock('../../src/utils/wait-for-paint');

// Media whose player gives `video` for picture-in-picture.
const createMedia = (video: HTMLVideoElement | null = null): MediaLoadedInfo => {
  const mediaPlayerController = mock<MediaPlayerController>();
  mediaPlayerController.getPIPElement.mockReturnValue(video);
  return { width: 640, height: 360, mediaPlayerController };
};

// Lets the controller's awaits run.
const settle = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) {
    await flushPromises();
  }
};

// Paints the test resolves by hand, in the order they were waited for.
const paints: (() => void)[] = [];

const createController = (options?: { showingPreservedFrame?: boolean }) => {
  const host = createLitElement();
  const controller = new PreservedFrameHoldController(host, {
    isShowingPreservedFrame: () => options?.showingPreservedFrame ?? true,
  });
  return { host, controller };
};

// @vitest-environment jsdom
describe('PreservedFrameHoldController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    paints.splice(0);
    vi.mocked(waitForPaint).mockImplementation(
      () => new Promise<void>((resolve) => paints.push(resolve)),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should register itself with the host', () => {
    const { host, controller } = createController();

    expect(host.addController).toHaveBeenCalledWith(controller);
  });

  it('should not hold without media', () => {
    const { controller } = createController();

    controller.setMedia(null);

    expect(controller.isHolding()).toBe(false);
  });

  it('should not hold when the loading image is not a preserved frame', () => {
    const { controller } = createController({ showingPreservedFrame: false });

    controller.setMedia(createMedia());

    expect(controller.isHolding()).toBe(false);
  });

  describe('should hold a preserved frame until the media has painted', () => {
    it('should hold until the video of the player has painted', async () => {
      const { host, controller } = createController();
      const video = document.createElement('video');

      controller.setMedia(createMedia(video));
      expect(controller.isHolding()).toBe(true);

      await settle();
      expect(waitForPaint).toHaveBeenCalledWith(video, expect.any(AbortSignal));
      expect(controller.isHolding()).toBe(true);

      paints[0]();
      await settle();

      expect(controller.isHolding()).toBe(false);
      expect(host.requestUpdate).toHaveBeenCalled();
    });

    it('should wait for a paint of media without a player', async () => {
      const { controller } = createController();

      controller.setMedia({ width: 640, height: 360 });
      await settle();

      expect(waitForPaint).toHaveBeenCalledWith(null, expect.any(AbortSignal));
    });

    it('should wait for the host to render the media first', async () => {
      let rendered: (value: boolean) => void = () => {};
      const host: ReactiveControllerHost = {
        addController: vi.fn(),
        removeController: vi.fn(),
        requestUpdate: vi.fn(),
        updateComplete: new Promise<boolean>((resolve) => (rendered = resolve)),
      };
      const controller = new PreservedFrameHoldController(host, {
        isShowingPreservedFrame: () => true,
      });

      controller.setMedia(createMedia());
      await settle();
      expect(waitForPaint).not.toHaveBeenCalled();

      rendered(true);
      await settle();
      expect(waitForPaint).toHaveBeenCalled();
    });
  });

  it('should end a hold that the media never paints', async () => {
    const { controller } = createController();
    controller.setMedia(createMedia());
    await settle();
    const signal = vi.mocked(waitForPaint).mock.calls[0][1];

    vi.advanceTimersByTime(PRESERVED_FRAME_HOLD_MAX_SECONDS * 1000 - 1);
    expect(controller.isHolding()).toBe(true);

    vi.advanceTimersByTime(1);
    expect(controller.isHolding()).toBe(false);
    expect(signal.aborted).toBe(true);
  });

  it('should hold afresh when the media is announced again', async () => {
    const { controller } = createController();
    controller.setMedia(createMedia());
    await settle();
    const firstSignal = vi.mocked(waitForPaint).mock.calls[0][1];

    vi.advanceTimersByTime(1500);
    controller.setMedia(createMedia());
    await settle();
    expect(firstSignal.aborted).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(controller.isHolding()).toBe(true);

    // The paint the first hold waited for no longer ends the second.
    paints[0]();
    await settle();
    expect(controller.isHolding()).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(controller.isHolding()).toBe(false);
  });

  it('should end the hold when the media goes away', () => {
    const { controller } = createController();
    controller.setMedia(createMedia());

    controller.setMedia(null);

    expect(controller.isHolding()).toBe(false);
  });

  it('should end the hold when the host disconnects', async () => {
    const { controller } = createController();
    controller.setMedia(createMedia());
    await settle();
    const signal = vi.mocked(waitForPaint).mock.calls[0][1];

    controller.hostDisconnected();

    expect(controller.isHolding()).toBe(false);
    expect(signal.aborted).toBe(true);
  });

  it('should not update the host when there is no hold to end', () => {
    const { host, controller } = createController();

    controller.hostDisconnected();

    expect(host.requestUpdate).not.toHaveBeenCalled();
  });
});
