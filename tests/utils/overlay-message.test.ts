import { describe, expect, it, vi } from 'vitest';
import {
  dispatchDismissOverlayMessageEvent,
  dispatchShowOverlayMessageEvent,
} from '../../src/utils/overlay-message';

// @vitest-environment jsdom
describe('overlay-message utils', () => {
  it('should dispatch show overlay message event', () => {
    const element = document.createElement('div');
    const message = { text: 'test' };
    const handler = vi.fn();
    element.addEventListener('advanced-camera-card:overlay-message:show', handler);

    dispatchShowOverlayMessageEvent(element, message);

    expect(handler).toHaveBeenCalled();
    const event = handler.mock.calls[0][0];
    expect(event.detail).toBe(message);
  });

  it('should dispatch dismiss overlay message event', () => {
    const element = document.createElement('div');
    const handler = vi.fn();
    element.addEventListener('advanced-camera-card:overlay-message:dismiss', handler);

    dispatchDismissOverlayMessageEvent(element);

    expect(handler).toHaveBeenCalled();
  });
});
