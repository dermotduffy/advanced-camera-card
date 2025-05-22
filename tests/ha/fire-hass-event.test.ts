import { describe, expect, it, vi } from 'vitest';
import { fireHASSEvent } from '../../src/ha/fire-hass-event';

// @vitest-environment jsdom
describe('fireHASSEvent', () => {
  it('should fire an event with specified type and detail', () => {
    const target = document.createElement('div');
    const handler = vi.fn();

    const type = 'll-custom';
    const detail = { action: 'test' };

    target.addEventListener(type, handler);

    fireHASSEvent(target, type, detail);

    expect(handler).toBeCalledWith(
      expect.objectContaining({
        detail,
      }),
    );
  });
});
