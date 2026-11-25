import type { LeakCheck } from './types';
import { convertToCountStrings } from './utils';

// Timers started while recording that have not been cancelled, nor fired if
// they fire once, each mapped to the name of the function that started it.
const pending = new Map<unknown, string>();
let recording = false;

const wrapStart = (name: string, firesOnce: boolean): void => {
  const start: unknown = Reflect.get(globalThis, name);
  if (typeof start !== 'function') {
    return;
  }

  Reflect.set(
    globalThis,
    name,
    function (this: unknown, handler: unknown, ...rest: unknown[]): unknown {
      if (!recording || typeof handler !== 'function') {
        return Reflect.apply(start, this, [handler, ...rest]);
      }

      let handle: unknown = null;
      const callback = function (this: unknown, ...args: unknown[]): unknown {
        if (firesOnce) {
          pending.delete(handle);
        }
        return Reflect.apply(handler, this, args);
      };
      handle = Reflect.apply(start, this, [callback, ...rest]);
      pending.set(handle, name);
      return handle;
    },
  );
};

const wrapCancel = (name: string): void => {
  const cancel: unknown = Reflect.get(globalThis, name);
  if (typeof cancel !== 'function') {
    return;
  }

  Reflect.set(
    globalThis,
    name,
    function (this: unknown, handle: unknown, ...rest: unknown[]): unknown {
      pending.delete(handle);
      return Reflect.apply(cancel, this, [handle, ...rest]);
    },
  );
};

// Wrapping happens on load, which a non-isolated test project does once per
// worker rather than once per test file.
wrapStart('setTimeout', true);
wrapStart('setInterval', false);
wrapStart('requestAnimationFrame', true);
wrapCancel('clearTimeout');
wrapCancel('clearInterval');
wrapCancel('cancelAnimationFrame');

export const timerLeakCheck: LeakCheck = {
  description:
    'Timers still pending (rerun with --detectAsyncLeaks to see where each started)',
  start: () => {
    pending.clear();
    recording = true;
  },
  finish: () => {
    recording = false;
    return convertToCountStrings([...pending.values()]);
  },
};
