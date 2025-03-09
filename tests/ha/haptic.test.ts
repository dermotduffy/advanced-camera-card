import { describe, expect, it, vi } from 'vitest';
import { fireHASSEvent } from '../../src/ha/fire-hass-event.js';
import { forwardHaptic, HapticType } from '../../src/ha/haptic.js';

vi.mock('../../src/ha/fire-hass-event.js', () => ({
  fireHASSEvent: vi.fn(),
}));

// @vitest-environment jsdom
describe('forwardHaptic', () => {
  it.each([
    ['success' as const],
    ['warning' as const],
    ['failure' as const],
    ['light' as const],
    ['medium' as const],
    ['heavy' as const],
    ['selection' as const],
  ])('should call fireHASSEvent with %s', (hapticType: HapticType) => {
    forwardHaptic(hapticType);

    expect(fireHASSEvent).toBeCalledWith(window, 'haptic', hapticType);
  });
});
