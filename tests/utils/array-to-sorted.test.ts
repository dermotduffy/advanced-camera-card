import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { polyfillArrayToSorted } from '../../src/utils/array-to-sorted';

type SortableArray = unknown[] & {
  toSorted?: (compareFn?: (a: unknown, b: unknown) => number) => unknown[];
};

const arrayPrototype = Array.prototype as SortableArray;

describe('polyfillArrayToSorted', () => {
  it('should leave a native Array.prototype.toSorted in place', () => {
    const native = arrayPrototype.toSorted;

    polyfillArrayToSorted();

    expect(arrayPrototype.toSorted).toBe(native);
  });

  describe('when the browser has no Array.prototype.toSorted', () => {
    let original: SortableArray['toSorted'];

    beforeEach(() => {
      original = arrayPrototype.toSorted;
      delete arrayPrototype.toSorted;
    });

    afterEach(() => {
      arrayPrototype.toSorted = original;
    });

    it('should sort a copy and leave the original array in place', () => {
      polyfillArrayToSorted();

      const values = [3, 1, 2];
      expect(arrayPrototype.toSorted?.call(values)).toEqual([1, 2, 3]);
      expect(values).toEqual([3, 1, 2]);
    });

    it('should use the comparison it is given', () => {
      polyfillArrayToSorted();

      expect(
        arrayPrototype.toSorted?.call([1, 10, 2], (a, b) => Number(a) - Number(b)),
      ).toEqual([1, 2, 10]);
    });

    it('should not install an enumerable property', () => {
      polyfillArrayToSorted();

      expect(Object.keys(arrayPrototype)).not.toContain('toSorted');
    });
  });
});
