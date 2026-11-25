// `tsconfig.json` sets the type library to ES2021, matching the oldest browser
// the card is built for, so `Object.hasOwn` needs typing here.
export interface ObjectConstructorWithHasOwn extends ObjectConstructor {
  hasOwn?: (object: object, property: PropertyKey) => boolean;
}

/**
 * Polyfill `Object.hasOwn` on browsers that lack it.
 *
 * Chrome gained `Object.hasOwn` in v93, and the card supports back to Chrome
 * v92 for Chromecast receivers. Known users:
 *  - `@noble/hashes`, a dependency of ha-nunjucks, which calls it as its module
 *    is evaluated (so it must be installed before that import).
 */
export const polyfillObjectHasOwn = (): void => {
  const objectConstructor: ObjectConstructorWithHasOwn = Object;
  if (objectConstructor.hasOwn) {
    return;
  }

  // Defined rather than assigned so the property is non-enumerable (i.e. does
  // not show up in `for...in`), just like the native version.
  Object.defineProperty(objectConstructor, 'hasOwn', {
    value: (object: object, property: PropertyKey): boolean =>
      Object.prototype.hasOwnProperty.call(object, property),
    writable: true,
    configurable: true,
  });
};
