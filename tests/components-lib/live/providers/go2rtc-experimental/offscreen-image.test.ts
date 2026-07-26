import { describe, expect, it, vi } from 'vitest';

import { OffscreenImage } from '../../../../../src/components-lib/live/providers/go2rtc-experimental/offscreen-image';

// @vitest-environment jsdom
describe('OffscreenImage', () => {
  it('should create the image from the factory on get', () => {
    const image = document.createElement('img');
    const offscreen = new OffscreenImage(() => image);

    expect(offscreen.get()).toBe(image);
  });

  it('should reuse the same image across repeated get', () => {
    const create = vi.fn(() => document.createElement('img'));
    const offscreen = new OffscreenImage(create);

    expect(offscreen.get()).toBe(offscreen.get());
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('should create an image with the default factory when none is injected', () => {
    const offscreen = new OffscreenImage();

    expect(offscreen.get()).toBeInstanceOf(HTMLImageElement);
  });

  it('should detach src on clear', () => {
    const image = document.createElement('img');
    const offscreen = new OffscreenImage(() => image);
    offscreen.get();
    image.src = 'data:image/jpeg;base64,AAAA';

    offscreen.clear();

    expect(image.hasAttribute('src')).toBe(false);
  });

  it('should create a fresh image after clear', () => {
    const create = vi.fn(() => document.createElement('img'));
    const offscreen = new OffscreenImage(create);
    offscreen.get();
    offscreen.clear();
    offscreen.get();

    expect(create).toHaveBeenCalledTimes(2);
  });

  it('should tolerate clear when no image is held', () => {
    const offscreen = new OffscreenImage(() => document.createElement('img'));

    expect(() => offscreen.clear()).not.toThrow();
  });
});
