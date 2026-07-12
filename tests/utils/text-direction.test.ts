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

  it('should return ltr for a null element', () => {
    expect(() => getTextDirection(null)).not.toThrow();
    expect(getTextDirection(null)).toBe('ltr');
  });

  it('should return ltr for an undefined element', () => {
    expect(() => getTextDirection(undefined)).not.toThrow();
    expect(getTextDirection(undefined)).toBe('ltr');
  });

  it('should return ltr for an element with no document view', () => {
    // A document created via `createHTMLDocument` has no browsing context, so
    // its `defaultView` is null -- mirroring a disconnected element on mobile
    // whose view has been torn down. `getComputedStyle` would throw here.
    const element = document.implementation.createHTMLDocument('').createElement('div');
    element.style.direction = 'rtl';

    expect(() => getTextDirection(element)).not.toThrow();
    expect(getTextDirection(element)).toBe('ltr');
  });
});
