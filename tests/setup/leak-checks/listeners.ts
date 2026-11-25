import type { LeakCheck } from './types';

// Listeners on the global `document` and `window` that were added while
// recording and not yet removed, keyed by target and event type.
const recorded = new Map<string, Set<EventListenerOrEventListenerObject>>();
let recording = false;

// Example: `document 'visibilitychange'`.
const getKey = (targetName: string, type: string): string => `${targetName} '${type}'`;

const wrapListenerMethods = (
  owner: EventTarget,
  target: EventTarget,
  targetName: string,
): void => {
  const addEventListener = owner.addEventListener;
  const removeEventListener = owner.removeEventListener;

  owner.addEventListener = function (
    this: unknown,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    // The DOM removes a `once` listener when it fires, without calling
    // `removeEventListener`, so recording one would incorrectly report it as
    // leaked.
    const isOnce = typeof options === 'object' && options.once;
    if (recording && this === target && listener && !isOnce) {
      const key = getKey(targetName, type);
      const listeners = recorded.get(key) ?? new Set();
      listeners.add(listener);
      recorded.set(key, listeners);
    }
    addEventListener.call(this, type, listener, options);
  };

  owner.removeEventListener = function (
    this: unknown,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void {
    if (this === target && listener) {
      recorded.get(getKey(targetName, type))?.delete(listener);
    }
    removeEventListener.call(this, type, listener, options);
  };
};

// Wrapping happens on load, which a non-isolated test project does once per
// worker rather than once per test file. The jsdom `document` inherits
// `addEventListener` and `removeEventListener` from `EventTarget.prototype`,
// while the test environment gives the global `window` its own copies of both.
wrapListenerMethods(EventTarget.prototype, document, 'document');
wrapListenerMethods(window, window, 'window');

export const listenerLeakCheck: LeakCheck = {
  description: 'Event listeners on the global document or window',
  start: () => {
    recorded.clear();
    recording = true;
  },
  finish: () => {
    recording = false;
    return [...recorded]
      .filter(([, listeners]) => listeners.size)
      .map(([key, listeners]) => `${key} x${listeners.size}`);
  },
};
