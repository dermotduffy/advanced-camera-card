import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ImageSurfaceController } from '../../../../../src/components-lib/live/providers/go2rtc-experimental/image-surface-controller';
import { createLitElement } from '../../../../test-utils';

const createFrame = (): Blob => new Blob(['frame'], { type: 'image/jpeg' });

// @vitest-environment jsdom
describe('ImageSurfaceController', () => {
  let nextId: number;

  beforeEach(() => {
    nextId = 0;
    URL.createObjectURL = vi.fn(() => `blob:mock-${nextId++}`);
    URL.revokeObjectURL = vi.fn();
  });

  const createdURLs = (): string[] =>
    vi.mocked(URL.createObjectURL).mock.results.map((result) => result.value);

  describe('controller', () => {
    it('should expose an image media player controller', () => {
      const surface = new ImageSurfaceController(createLitElement(), () => null);

      expect(surface.getMediaPlayer().getPIPElement()).toBeNull();
    });

    it('should have liveness when given liveness options', () => {
      const surface = new ImageSurfaceController(createLitElement(), () => null, {
        livenessOptions: { isFrameExpected: () => true, stallWindowSeconds: 10 },
      });

      expect(surface.getMediaPlayer().subscribeLiveness).toBeDefined();
    });

    it('should have no liveness without liveness options', () => {
      const surface = new ImageSurfaceController(createLitElement(), () => null);

      expect(surface.getMediaPlayer().subscribeLiveness).toBeUndefined();
    });

    it('should expose the image element', () => {
      const image = document.createElement('img');
      const surface = new ImageSurfaceController(createLitElement(), () => image);

      expect(surface.getElement()).toBe(image);
    });
  });

  describe('showFrame', () => {
    it('should show a frame on the image via an object URL', () => {
      const image = document.createElement('img');
      const surface = new ImageSurfaceController(createLitElement(), () => image);

      surface.showFrame(createFrame());

      expect(URL.createObjectURL).toBeCalledTimes(1);
      expect(image.getAttribute('src')).toBe(createdURLs()[0]);
      expect(URL.revokeObjectURL).not.toBeCalled();
    });

    it('should revoke the previous frame when showing the next', () => {
      const image = document.createElement('img');
      const surface = new ImageSurfaceController(createLitElement(), () => image);

      surface.showFrame(createFrame());
      surface.showFrame(createFrame());

      expect(image.getAttribute('src')).toBe(createdURLs()[1]);
      expect(URL.revokeObjectURL).toBeCalledTimes(1);
      expect(URL.revokeObjectURL).toBeCalledWith(createdURLs()[0]);
    });

    it('should do nothing without an image element', () => {
      const surface = new ImageSurfaceController(createLitElement(), () => null);

      surface.showFrame(createFrame());

      expect(URL.createObjectURL).not.toBeCalled();
    });
  });

  describe('reset', () => {
    it('should revoke the current object URL and clear the image', () => {
      const image = document.createElement('img');
      const surface = new ImageSurfaceController(createLitElement(), () => image);
      surface.showFrame(createFrame());

      surface.reset();

      expect(URL.revokeObjectURL).toBeCalledWith(createdURLs()[0]);
      expect(image.hasAttribute('src')).toBe(false);
    });

    it('should clear the image with no frame shown', () => {
      const image = document.createElement('img');
      const surface = new ImageSurfaceController(createLitElement(), () => image);

      surface.reset();

      expect(URL.revokeObjectURL).not.toBeCalled();
      expect(image.hasAttribute('src')).toBe(false);
    });

    it('should do nothing without an image element', () => {
      const surface = new ImageSurfaceController(createLitElement(), () => null);

      expect(() => surface.reset()).not.toThrow();
      expect(URL.revokeObjectURL).not.toBeCalled();
    });
  });
});
