import { assert, describe, expect, it, onTestFinished } from 'vitest';

import '../../src/components/media-dimensions-container';

import type { Size } from '../../src/utils/basic';

interface Containers {
  inner: HTMLElement;
  outer: HTMLElement;
}

// A 500x1000 box holding media of the given natural size, rotated by 90 degrees
// and scaled to half size by an ancestor.
const createRotatedMedia = async (media: Size): Promise<Containers> => {
  const scaler = document.createElement('div');
  scaler.style.transform = 'scale(0.5)';
  scaler.style.transformOrigin = 'top left';
  scaler.style.width = '500px';
  scaler.style.height = '1000px';

  const container = document.createElement(
    'advanced-camera-card-media-dimensions-container',
  );
  container.dimensionsConfig = { rotation: 90 };

  const content = document.createElement('div');
  content.style.width = `${media.width}px`;
  content.style.height = `${media.height}px`;
  container.append(content);

  scaler.append(container);
  document.body.append(scaler);
  onTestFinished(() => scaler.remove());

  await container.updateComplete;

  const inner = container.shadowRoot?.querySelector<HTMLElement>('.inner');
  const outer = container.shadowRoot?.querySelector<HTMLElement>('.outer');
  assert(inner && outer);
  return { inner, outer };
};

describe('AdvancedCameraCardMediaDimensionsContainer', () => {
  it('should fit rotated media to the host width when an ancestor scales it', async () => {
    // Portrait media (ratio 0.5) rotated to landscape across the 500 width.
    const { inner, outer } = await createRotatedMedia({ width: 1000, height: 2000 });

    expect(inner.style.width).toBe('250px');
    expect(inner.style.height).toBe('500px');
    expect(outer.style.height).toBe('250px');
  });

  it('should limit rotated media to the host height', async () => {
    // Landscape media (ratio 4) rotated to portrait would stand 2000 tall, so it
    // is limited to the 1000 height.
    const { inner, outer } = await createRotatedMedia({ width: 2000, height: 500 });

    expect(inner.style.width).toBe('1000px');
    expect(inner.style.height).toBe('250px');
    expect(outer.style.height).toBe('1000px');
  });
});
