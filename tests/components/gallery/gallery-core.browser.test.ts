import { describe, expect, it, onTestFinished, vi } from 'vitest';

import '../../../src/components/gallery/gallery-core';

describe('AdvancedCameraCardGalleryCore', () => {
  it('should scroll to the top of a tall selected thumbnail in a scaled gallery', async () => {
    const scaler = document.createElement('div');
    scaler.style.transform = 'scale(0.5)';
    scaler.style.transformOrigin = 'top left';
    scaler.style.width = '400px';
    scaler.style.height = '200px';

    const gallery = document.createElement('advanced-camera-card-gallery-core');
    const thumbnails = [...Array(8).keys()].map(() => {
      const thumbnail = document.createElement('div');
      thumbnail.style.height = '300px';
      return thumbnail;
    });
    const selected = thumbnails[thumbnails.length - 1];
    selected.setAttribute('selected', '');
    gallery.append(...thumbnails);

    scaler.append(gallery);
    document.body.append(scaler);
    onTestFinished(() => scaler.remove());

    await vi.waitFor(() => expect(gallery.scrollTop).toBeGreaterThan(0));

    // Centering the 300 high thumbnail in the 200 high gallery would put its top
    // above the top of the gallery.
    expect(selected.getBoundingClientRect().top).toBeCloseTo(
      gallery.getBoundingClientRect().top,
      0,
    );
  });
});
