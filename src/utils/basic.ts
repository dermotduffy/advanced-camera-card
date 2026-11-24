import type { StyleInfo } from 'lit/directives/style-map.js';
import { isEqual, isEqualWith, mergeWith, round, uniq, uniqWith } from 'lodash-es';

import { AdvancedCameraCardError } from '../types';

/**
 * Prettify a title by converting '_' to spaces and capitalizing words.
 * @param input The input string.
 * @returns A prettified name.
 */
export function prettifyTitle(input: string): string;
export function prettifyTitle(input?: string): string | undefined;
export function prettifyTitle(input?: string): string | undefined {
  if (!input) {
    return undefined;
  }
  const words = input.trim().split(/[_\s]+/);
  return words
    .map((word) => {
      return word[0].toUpperCase() + word.substring(1);
    })
    .join(' ');
}

/**
 * Move an element within an array.
 * @param target Target array.
 * @param from From index.
 * @param to To index.
 */
export function arrayMove(target: unknown[], from: number, to: number): unknown[] {
  const element = target[from];
  target.splice(from, 1);
  target.splice(to, 0, element);
  return target;
}

/**
 * Convert a value to an array if it is not already one, dropping falsy inputs
 * (`undefined`/`null`/`0`/`false`/`''`) to an empty array. Use when an absent or
 * empty value should become `[]`; use `arrayifyWithFalsy` when falsy values are
 * significant and must be preserved.
 * @param value: A value (which may be an array).
 * @returns An array.
 */
export const arrayify = <T>(value?: T | T[]): T[] => {
  return value ? (Array.isArray(value) ? value : [value]) : [];
};

/**
 * Wrap a value in an array if it is not already one, preserving the value --
 * including falsy ones like `0`, `false`, `''` and `null`. Contrast with
 * `arrayify`, which instead drops all falsy inputs to `[]`.
 * @param value A value (which may be an array).
 * @returns An array.
 */
export const arrayifyWithFalsy = <T>(value: T | T[]): T[] =>
  Array.isArray(value) ? value : [value];

/**
 * Convert a value to an set if it is not already one.
 * @param value: A value (which may be a set, an array or a T)
 * @returns A set of T.
 */
export const setify = <T>(value: T | T[] | Set<T>): Set<T> => {
  return value instanceof Set ? value : new Set(arrayify(value));
};

/**
 * Get a unanimous value from a collection, or null if there isn't one.
 */
export const getUnanimousValue = <T>(values: (T | null | undefined)[]): T | null => {
  const unique = uniqWith(values, isEqual);
  return unique.length === 1 ? unique[0] ?? null : null;
};

/**
 * Determine if the contents of the n(ew) and o(ld) values have changed. For use
 * in lit web components that may have a value that changes address but not
 * contents -- and for which a re-render is expensive/jarring.
 * @param n The new value.
 * @param o The old value.
 * @returns `true` is the contents have changed.
 */
export function contentsChanged(
  n: unknown,
  o: unknown,
  customizer?: (a: unknown, b: unknown) => boolean | undefined,
): boolean {
  return !isEqualWith(n, o, customizer);
}

// Get a description from thrown value preferring the browser's sentence ("The
// peer connection is closed") over the bare type name ("InvalidStateError").
//
// DOMException may not inherit from Error, and catch blocks may be handed
// anything, so details are extracted structurally rather than via `instanceof
// Error`.
export const getErrorDescription = (error: unknown): string | null => {
  if (!isRecord(error)) {
    return null;
  }
  const message = typeof error.message === 'string' ? error.message : '';
  const name = typeof error.name === 'string' ? error.name : '';
  return message || name || null;
};

/**
 * Log an error as a warning to the console.
 * @param e The caught error or error-like value.
 * @param func The Console func to call.
 */
export function errorToConsole(e: unknown, func: CallableFunction = console.warn): void {
  if (!e) {
    return;
  }
  if (e instanceof AdvancedCameraCardError && e.context) {
    func(e, e.context);
  } else if (typeof e === 'object' && 'message' in e) {
    func(e.message);
  } else {
    func(e);
  }
}

export interface Point {
  x: number;
  y: number;
}

export const getDistance = (a: Point, b: Point): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface Size {
  width: number;
  height: number;
}

/**
 * @param point A point, in the coordinates the box is measured in.
 * @param box The box.
 * @returns `true` if the point is inside the box or on its edge.
 */
export const isPointInBox = (point: Point, box: Box): boolean =>
  point.x >= box.left &&
  point.x <= box.right &&
  point.y >= box.top &&
  point.y <= box.bottom;

/**
 * Determine if the device supports hovering.
 * @returns `true` if the device supports hovering, `false` otherwise.
 */
export const isHoverableDevice = (): boolean =>
  window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/**
 * Run a function in idle periods. If idle callbacks are not supported (e.g.
 * Safari) the callback is run immediately.
 * @param func The function to call.
 * @param timeout The maximum number of seconds to wait.
 */
export const runWhenIdleIfSupported = (func: () => void, timeout?: number): void => {
  if (window.requestIdleCallback) {
    window.requestIdleCallback(func, {
      ...(timeout && { timeout: timeout }),
    });
  } else {
    func();
  }
};

export const allPromises = async <T, R>(
  items: Iterable<T>,
  func: (arg: T) => R,
): Promise<Awaited<R>[]> => {
  return await Promise.all(Array.from(items).map((item) => func(item)));
};

export const isSuperset = (superset: Set<unknown>, subset: Set<unknown>) => {
  for (const item of subset) {
    if (!superset.has(item)) {
      return false;
    }
  }
  return true;
};

/**
 * Set or remove an attribute on a HTMLElement.
 * @param element The element.
 * @param set If `true` sets the attribute, otherwise removes it.
 * @param name The attribute name.
 * @param value An optional value to set the attribute to.
 */
export const setOrRemoveAttribute = <T extends string>(
  element: HTMLElement,
  set: boolean,
  name: string,
  value?: T | null,
): void => {
  if (set) {
    element.setAttribute(name, value ?? '');
  } else {
    element.removeAttribute(name);
  }
};

/**
 * Set or remove a style property on a HTMLElement.
 * @param element The element.
 * @param set If `true` sets the property, otherwise removes it.
 * @param name The property name.
 * @param value An optional value to set the property to. Never used if set is
 * `false`.
 */
export const setOrRemoveStyleProperty = <T extends string>(
  element: HTMLElement,
  set: boolean,
  name: string,
  value?: T,
): void => {
  if (set) {
    element.style.setProperty(name, value ?? '');
  } else {
    element.style.removeProperty(name);
  }
};

/**
 * Allow typescript to narrow types based on truthy filter.
 */
export const isTruthy = <T>(x: T | false | undefined | null | '' | 0): x is T => !!x;

/**
 * Allow typescript to narrow an unknown value to a non-null object.
 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Allow typescript to narrow types for HTMLElements.
 */
export const isHTMLElement = (element: unknown): element is HTMLElement =>
  element instanceof HTMLElement;

export const getChildrenFromElement = (parent: HTMLElement): HTMLElement[] => {
  const children =
    parent instanceof HTMLSlotElement
      ? parent.assignedElements({ flatten: true })
      : [...parent.children];
  return children.filter(isHTMLElement);
};

export const recursivelyMergeObjectsNotArrays = <T>(
  ...srcs: (Partial<T> | undefined | null)[]
): T => {
  return mergeWith({}, ...srcs, (_a: unknown, b: unknown) =>
    Array.isArray(b) ? b : undefined,
  );
};

export const recursivelyMergeObjectsConcatenatingArraysUniquely = <T>(
  ...srcs: (Partial<T> | undefined | null)[]
): T => {
  return mergeWith({}, ...srcs, (a: unknown, b: unknown) =>
    Array.isArray(a) ? uniq(a.concat(b)) : undefined,
  );
};

export const isValidAspectRatio = (ratio?: number[] | null): ratio is number[] =>
  ratio?.length === 2 &&
  ratio.every((dimension) => Number.isFinite(dimension) && dimension > 0);

export const aspectRatioToString = (options?: {
  ratio?: number[] | null;
  defaultStatic?: boolean;
}): string => {
  const ratio = options?.ratio;
  if (isValidAspectRatio(ratio)) {
    return `${ratio[0]} / ${ratio[1]}`;
  } else if (options?.defaultStatic) {
    return '16 / 9';
  } else {
    return 'auto';
  }
};

export const aspectRatioToStyle = (options?: {
  ratio?: number[];
  defaultStatic?: boolean;
}): StyleInfo => {
  return {
    'aspect-ratio': aspectRatioToString(options),
  };
};

/**
 * Remove empty slots from nested arrays.
 */
export const desparsifyArrays = <T>(data: T): T => {
  if (Array.isArray(data)) {
    return <T>(
      data.filter((item) => item !== undefined).map((item) => desparsifyArrays(item))
    );
  } else if (isRecord(data)) {
    const result: Record<string | number | symbol, unknown> = {};
    for (const key in data) {
      result[key] = desparsifyArrays(data[key]);
    }
    return <T>result;
  }
  return data;
};

export const arefloatsApproximatelyEqual = (
  a: number,
  b: number,
  precision?: number,
): boolean => {
  return round(a, precision) === round(b, precision);
};

/**
 * Create a lodash isEqualsWith customizer that can compare floats.
 */
export const generateFloatApproximatelyEqualsCustomizer = (
  precision: number,
): ((a: unknown, b: unknown) => boolean | undefined) => {
  return (a: unknown, b: unknown) => {
    return typeof a === 'number' && typeof b === 'number'
      ? arefloatsApproximatelyEqual(a, b, precision)
      : undefined;
  };
};

// For change-detection equality: a function's identity churns and is not
// observable state, so two functions compare equal; a function appearing or
// disappearing is still a real change. Only apply where a data field beside the
// callback carries the meaningful change, not where a function's identity is
// itself the state (e.g. a controller keyed by which element it wraps).
export const ignoreFunctionIdentity = (a: unknown, b: unknown): boolean | undefined =>
  typeof a === 'function' || typeof b === 'function'
    ? typeof a === 'function' && typeof b === 'function'
    : undefined;

export const forceReflow = (element: HTMLElement): void => {
  // Force reflow by measuring the height.
  void element.offsetHeight;
};

// The element's size ignoring any transform on it or its ancestors, which makes
// it safe to write back to a CSS length such as `max-height`.
export const getLayoutSize = (element: HTMLElement): Size => ({
  width: element.offsetWidth,
  height: element.offsetHeight,
});
