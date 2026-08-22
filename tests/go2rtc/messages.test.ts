import { describe, expect, it } from 'vitest';

import { isServerErrorForMode } from '../../src/go2rtc/messages';

describe('isServerErrorForMode', () => {
  it('should match an error for the mode', () => {
    expect(isServerErrorForMode({ type: 'error', value: 'mse: not found' }, 'mse')).toBe(
      true,
    );
  });

  it('should not match an error for another mode', () => {
    expect(isServerErrorForMode({ type: 'error', value: 'webrtc: failed' }, 'mse')).toBe(
      false,
    );
  });

  it('should not match a non-error message', () => {
    expect(isServerErrorForMode({ type: 'mse', value: 'codecs' }, 'mse')).toBe(false);
  });

  it('should not match an error with a non-string value', () => {
    expect(isServerErrorForMode({ type: 'error', value: 42 }, 'mse')).toBe(false);
  });

  it('should not match an error with no value', () => {
    expect(isServerErrorForMode({ type: 'error' }, 'mse')).toBe(false);
  });
});
