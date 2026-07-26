import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ImageSurfaceController } from '../../../../../src/components-lib/live/providers/go2rtc-experimental/image-surface-controller';
import { createLitElement, flushPromises } from '../../../../test-utils';

const createFrame = (): Blob => new Blob(['frame'], { type: 'image/jpeg' });

// @vitest-environment jsdom
describe('ImageSurfaceController', () => {
  let nextId: number;

  beforeEach(() => {
    nextId = 0;
    URL.createObjectURL = vi.fn(() => `blob:mock-${nextId++}`);
    URL.revokeObjectURL = vi.fn();
    document.body.replaceChildren();
  });

  const createdURLs = (): string[] =>
    vi.mocked(URL.createObjectURL).mock.results.map((result) => result.value);

  // A connected visible <img> plus a detached loader whose decode() is stubbed
  // (jsdom has none). The loader is injected so a test can hold a decode in
  // flight to exercise coalescing.
  const createSurfaceController = (options?: {
    connected?: boolean;
    decode?: () => Promise<void>;
  }) => {
    const image = document.createElement('img');
    if (options?.connected !== false) {
      document.body.appendChild(image);
    }
    const decoder = document.createElement('img');
    decoder.decode = vi.fn(options?.decode ?? (() => Promise.resolve()));
    const controller = new ImageSurfaceController(createLitElement(), () => image, {
      createImage: () => decoder,
    });
    return { image, decoder, controller };
  };

  describe('controller', () => {
    it('should expose an image media player controller', () => {
      const controller = new ImageSurfaceController(createLitElement(), () => null);

      expect(controller.getMediaPlayer().getPIPElement()).toBeNull();
    });

    it('should have liveness when given liveness options', () => {
      const controller = new ImageSurfaceController(createLitElement(), () => null, {
        livenessOptions: { isFrameExpected: () => true, stallWindowSeconds: 10 },
      });

      expect(controller.getMediaPlayer().subscribeLiveness).toBeDefined();
    });

    it('should have no liveness without liveness options', () => {
      const controller = new ImageSurfaceController(createLitElement(), () => null);

      expect(controller.getMediaPlayer().subscribeLiveness).toBeUndefined();
    });

    it('should expose the image element', () => {
      const { image, controller } = createSurfaceController();

      expect(controller.getElement()).toBe(image);
    });
  });

  describe('showFrame', () => {
    it('should decode a frame off-DOM and show it via an object URL', async () => {
      const { image, decoder, controller } = createSurfaceController();

      await controller.showFrame(createFrame());

      expect(decoder.decode).toHaveBeenCalledTimes(1);
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      expect(image.getAttribute('src')).toBe(createdURLs()[0]);
      expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    });

    it('should revoke the previous frame when showing the next', async () => {
      const { image, controller } = createSurfaceController();

      await controller.showFrame(createFrame());
      await controller.showFrame(createFrame());

      expect(image.getAttribute('src')).toBe(createdURLs()[1]);
      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(createdURLs()[0]);
    });

    it('should keep showing the previous frame until the next has decoded', async () => {
      let releaseSecond: () => void = () => {};
      let calls = 0;
      const { image, controller } = createSurfaceController({
        decode: () => {
          calls++;
          return calls >= 2
            ? new Promise<void>((resolve) => (releaseSecond = resolve))
            : Promise.resolve();
        },
      });

      await controller.showFrame(createFrame());
      expect(image.getAttribute('src')).toBe(createdURLs()[0]);

      controller.showFrame(createFrame());
      await flushPromises();

      // The next frame is still decoding off-DOM, so the visible <img> is
      // untouched and the previous URL stays valid (revoking it would blank it).
      expect(image.getAttribute('src')).toBe(createdURLs()[0]);
      expect(URL.revokeObjectURL).not.toHaveBeenCalled();

      releaseSecond();
      await flushPromises();

      expect(image.getAttribute('src')).toBe(createdURLs()[1]);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(createdURLs()[0]);
    });

    it('should present only the newest frame while a decode is in flight', async () => {
      let releaseDecode: () => void = () => {};
      const decoding = new Promise<void>((resolve) => (releaseDecode = resolve));
      const { image, controller } = createSurfaceController({ decode: () => decoding });

      controller.showFrame(createFrame());
      controller.showFrame(createFrame());
      controller.showFrame(createFrame());
      await flushPromises();

      // Only the first frame's decode has started; the rest wait behind it.
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

      releaseDecode();
      await flushPromises();

      // The middle frame was superseded, so only the newest is presented next.
      expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
      expect(image.getAttribute('src')).toBe(createdURLs()[1]);
    });

    it('should drop an undecodable frame and keep the current one', async () => {
      const { image, controller } = createSurfaceController({
        decode: () => Promise.reject(new Error('bad frame')),
      });

      await controller.showFrame(createFrame());

      expect(image.hasAttribute('src')).toBe(false);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(createdURLs()[0]);
    });

    it('should not paint a frame that decoded after the surface detached', async () => {
      let releaseDecode: () => void = () => {};
      const { image, controller } = createSurfaceController({
        decode: () => new Promise<void>((resolve) => (releaseDecode = resolve)),
      });

      controller.showFrame(createFrame());
      await flushPromises();

      image.remove();
      releaseDecode();
      await flushPromises();

      expect(image.hasAttribute('src')).toBe(false);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(createdURLs()[0]);
    });

    it('should do nothing without an image element', async () => {
      const controller = new ImageSurfaceController(createLitElement(), () => null);

      await controller.showFrame(createFrame());

      expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('should not paint onto a detached element', async () => {
      const { controller } = createSurfaceController({ connected: false });

      await controller.showFrame(createFrame());

      expect(URL.createObjectURL).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should revoke the current object URL and clear the image', async () => {
      const { image, controller } = createSurfaceController();
      await controller.showFrame(createFrame());

      controller.reset();

      expect(URL.revokeObjectURL).toHaveBeenCalledWith(createdURLs()[0]);
      expect(image.hasAttribute('src')).toBe(false);
    });

    it('should clear the image with no frame shown', () => {
      const { image, controller } = createSurfaceController();

      controller.reset();

      expect(URL.revokeObjectURL).not.toHaveBeenCalled();
      expect(image.hasAttribute('src')).toBe(false);
    });

    it('should drop a frame still decoding so it never paints', async () => {
      let releaseDecode: () => void = () => {};
      const { image, controller } = createSurfaceController({
        decode: () => new Promise<void>((resolve) => (releaseDecode = resolve)),
      });

      controller.showFrame(createFrame());
      await flushPromises();

      controller.reset();
      releaseDecode();
      await flushPromises();

      // The in-flight frame was invalidated by reset, so it never painted.
      expect(image.hasAttribute('src')).toBe(false);
    });

    it('should do nothing without an image element', () => {
      const controller = new ImageSurfaceController(createLitElement(), () => null);

      expect(() => controller.reset()).not.toThrow();
      expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    });
  });
});
