import { describe, expect, it } from 'vitest';

import { getTextDirection } from '../../src/utils/text-direction.js';

// @vitest-environment jsdom
describe('getTextDirection', () => {
  it('should return rtl', () => {
    const element = document.createElement('div');
    element.style.direction = 'rtl';

    expect(getTextDirection(element)).toBe('rtl');
  });

  it('should return ltr', () => {
    const element = document.createElement('div');
    element.style.direction = 'ltr';

    expect(getTextDirection(element)).toBe('ltr');
  });

  it('should return ltr by default', () => {
    const element = document.createElement('div');
    element.style.direction = '_ANYTHING_ELSE_';

    expect(getTextDirection(element)).toBe('ltr');
  });
});
