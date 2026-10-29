import { stubConnectedHomeAssistant } from './test-utils';

// p-queue 10 raises Node's listener cap on itself via `process.getBuiltinModule`.
// jsdom's `EventTarget` is not Node's, so `setMaxListeners` throws and every
// queue fails to construct. Browsers have no `getBuiltinModule`; this keeps
// that call from rejecting a jsdom `EventTarget`.
const eventsModule = 'node:events';
const patched = Symbol.for('advanced-camera-card.p-queue-jsdom');
const processWithPatch = process as NodeJS.Process & { [patched]?: boolean };

if (!processWithPatch[patched] && process.getBuiltinModule) {
  processWithPatch[patched] = true;
  const getBuiltinModule = process.getBuiltinModule.bind(process);
  process.getBuiltinModule = ((id: string) => {
    const loaded = getBuiltinModule(id);
    if (id !== eventsModule || !loaded || !('setMaxListeners' in loaded)) {
      return loaded;
    }
    const events = loaded as {
      setMaxListeners: (max: number, ...targets: unknown[]) => void;
    };
    return new Proxy(loaded, {
      get(target, property, receiver) {
        if (property === 'setMaxListeners') {
          return (max: number, ...eventTargets: unknown[]) => {
            try {
              events.setMaxListeners(max, ...eventTargets);
            } catch (error) {
              if (
                error instanceof TypeError &&
                'code' in error &&
                error.code === 'ERR_INVALID_ARG_TYPE'
              ) {
                return;
              }
              throw error;
            }
          };
        }
        return Reflect.get(target, property, receiver);
      },
    });
  }) as typeof process.getBuiltinModule;
}

// ha-nunjucks initializes once, on first import, and deletes itself if that
// attempt throws. Install the element before any test file can import it.
stubConnectedHomeAssistant();
