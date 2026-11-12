import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  polyfillObjectHasOwn,
  type ObjectConstructorWithHasOwn,
} from '../../src/utils/object-has-own';

const objectConstructor: ObjectConstructorWithHasOwn = Object;

describe('polyfillObjectHasOwn', () => {
  it('should leave a native Object.hasOwn in place', () => {
    const native = objectConstructor.hasOwn;

    polyfillObjectHasOwn();

    expect(objectConstructor.hasOwn).toBe(native);
  });

  describe('when the browser has no Object.hasOwn', () => {
    let original: ObjectConstructorWithHasOwn['hasOwn'];

    beforeEach(() => {
      original = objectConstructor.hasOwn;

      // Emulates an older browser (e.g. a Chromecast receiver).
      delete objectConstructor.hasOwn;

      polyfillObjectHasOwn();
    });

    afterEach(() => {
      objectConstructor.hasOwn = original;
    });

    it('should report a property the object owns', () => {
      expect(objectConstructor.hasOwn?.({ camera: 'camera.office' }, 'camera')).toBe(
        true,
      );
    });

    it('should not install an enumerable property', () => {
      expect(Object.keys(objectConstructor)).not.toContain('hasOwn');
    });

    it('should report a property the object owns with an undefined value', () => {
      expect(objectConstructor.hasOwn?.({ camera: undefined }, 'camera')).toBe(true);
    });

    it('should not report a property the object inherits', () => {
      expect(objectConstructor.hasOwn?.({}, 'toString')).toBe(false);
    });

    it('should not report a property the object lacks', () => {
      expect(objectConstructor.hasOwn?.({ camera: 'camera.office' }, 'view')).toBe(
        false,
      );
    });
  });
});
