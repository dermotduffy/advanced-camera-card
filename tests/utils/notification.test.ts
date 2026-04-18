import { describe, expect, it, vi } from 'vitest';
import { dispatchDismissNotificationEvent } from '../../src/utils/notification';

// @vitest-environment jsdom
describe('notification utils', () => {
  it('should dispatch dismiss notification event', () => {
    const element = document.createElement('div');
    const handler = vi.fn();
    element.addEventListener('advanced-camera-card:notification:dismiss', handler);

    dispatchDismissNotificationEvent(element);

    expect(handler).toHaveBeenCalled();
  });
});
