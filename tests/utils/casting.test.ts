import { describe, expect, it, vi } from 'vitest';

import { isBeingCasted } from '../../src/utils/casting.js';

describe('isBeingCasted', () => {
  it('should confirm being casted', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Fuchsia) AppleWebKit/537.36 (KHTML, like Gecko) ' +
        'Chrome/114.0.0.0 Safari/537.36 CrKey/1.56.500000',
    });

    // Import the function
    expect(isBeingCasted()).toBeTruthy();
  });

  it('should confirm not being casted', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
        'Chrome/131.0.0.0 Safari/537.36',
    });

    // Import the function
    expect(isBeingCasted()).toBeFalsy();
  });
});
