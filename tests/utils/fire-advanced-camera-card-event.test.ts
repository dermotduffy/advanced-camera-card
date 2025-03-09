import { describe, expect, it, vi } from 'vitest';
import { fireAdvancedCameraCardEvent } from '../../src/utils/fire-advanced-camera-card-event.js';

// @vitest-environment jsdom
describe('fireAdvancedCameraCardEvent', () => {
  it('should fire event without data', () => {
    const element = document.createElement('div');
    const handler = vi.fn();
    element.addEventListener('advanced-camera-card:foo', handler);

    fireAdvancedCameraCardEvent(element, 'foo');
    expect(handler).toBeCalled();
  });

  it('should fire event with data', () => {
    const element = document.createElement('div');
    const data = { bar: 2 };
    const handler = vi.fn((ev) => {
      expect(ev.detail).toBe(data);
    });

    element.addEventListener('advanced-camera-card:foo', handler);
    fireAdvancedCameraCardEvent(element, 'foo', data);
    expect(handler).toBeCalled();
  });
});
