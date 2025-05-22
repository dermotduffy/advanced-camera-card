import { describe, expect, it } from 'vitest';
import { isHARelativeURL } from '../../src/ha/is-ha-relative-url';

describe('isHARelativeURL', () => {
  it('returns true for a simple relative URL', () => {
    expect(isHARelativeURL('/image.jpg')).toBe(true);
  });

  it('returns true for root path', () => {
    expect(isHARelativeURL('/')).toBe(true);
  });

  it('returns false for undefined', () => {
    expect(isHARelativeURL()).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isHARelativeURL('')).toBe(false);
  });

  it('returns false for absolute URL', () => {
    expect(isHARelativeURL('https://card.camera/image.jpg')).toBe(false);
  });
});
