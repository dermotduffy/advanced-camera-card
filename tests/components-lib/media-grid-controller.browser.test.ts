import { describe, expect, it, onTestFinished } from 'vitest';

import { MediaGridController } from '../../src/components-lib/media-grid-controller';

const COLUMN_SIZE_PROPERTY = '--advanced-camera-card-grid-column-size';

const createGrid = (transform?: string): HTMLElement => {
  const container = document.createElement('div');
  if (transform) {
    container.style.transform = transform;
  }

  const host = document.createElement('div');
  host.style.width = '1000px';
  for (const id of ['office', 'kitchen']) {
    const cell = document.createElement('div');
    cell.setAttribute('grid-id', id);
    host.append(cell);
  }
  container.append(host);
  document.body.append(container);
  onTestFinished(() => container.remove());

  const controller = new MediaGridController(host);
  onTestFinished(() => controller.destroy());

  return host;
};

describe('MediaGridController', () => {
  it('should size columns from the unscaled width when an ancestor scales the grid', () => {
    const unscaled = createGrid();
    const scaled = createGrid('scale(0.5)');

    expect(unscaled.style.getPropertyValue(COLUMN_SIZE_PROPERTY)).not.toBe('');
    expect(scaled.style.getPropertyValue(COLUMN_SIZE_PROPERTY)).toBe(
      unscaled.style.getPropertyValue(COLUMN_SIZE_PROPERTY),
    );
  });
});
