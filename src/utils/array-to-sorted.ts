// vis-timeline 8 sorts with `Array.prototype.toSorted` (ES2023). Chromecast
// receivers still run Chrome 92, and Firefox 113 is the card's floor, so both
// lack it. `src/card.ts` imports this module first so the method exists before
// the timeline is loaded.

type SortableArray = unknown[] & {
  toSorted?: (compareFn?: (a: unknown, b: unknown) => number) => unknown[];
};

const arrayPrototype = Array.prototype as SortableArray;

export const polyfillArrayToSorted = (): void => {
  if (typeof arrayPrototype.toSorted === 'function') {
    return;
  }

  Object.defineProperty(arrayPrototype, 'toSorted', {
    value(this: unknown[], compareFn?: (a: unknown, b: unknown) => number): unknown[] {
      return this.slice().sort(compareFn);
    },
    writable: true,
    configurable: true,
  });
};

polyfillArrayToSorted();
