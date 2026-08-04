import { beforeAll, describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';

import { defineHAElementStubs } from '../browser/ha-element-stubs';
import { flushBrowserWork, loadModule } from './test-utils';

beforeAll(() => {
  // The card subclasses Home Assistant's own player elements once those exist.
  // Without them the chunks holding the subclasses still load, but never run
  // them.
  defineHAElementStubs();
});

describe('every chunk the build emits', () => {
  it('should load correctly', async () => {
    const chunks = (await commands.listDistFiles()).filter((file) =>
      file.endsWith('.js'),
    );
    expect(chunks.length).toBeGreaterThan(0);

    const failures: string[] = [];

    // What a chunk throws while running is reported to `window` rather than to
    // whoever loaded it. The browser names the file it came from.
    const recordError = (event: ErrorEvent): void => {
      failures.push(`${event.filename}: ${event.message}`);
    };
    window.addEventListener('error', recordError);

    // Part of what a chunk runs can be deferred to a promise it keeps to itself
    // (e.g. the player subclasses wait on Home Assistant's own element), which
    // is reported separately and without naming a file.
    const recordRejection = (event: PromiseRejectionEvent): void => {
      failures.push(`${event.reason}`);
    };
    window.addEventListener('unhandledrejection', recordRejection);

    try {
      // Most of what the build emits is reached only by a view the user has to
      // navigate to, so nothing else here runs it. A chunk that throws the
      // moment it is loaded -- a dependency resolved to a build the code using
      // it cannot call, say -- reaches a user as a view that renders empty, and
      // does so without failing any other test.
      for (const chunk of chunks) {
        try {
          await loadModule(`/${chunk}`);
        } catch (error) {
          failures.push(`${chunk}: ${error}`);
        }
      }

      // Need to flush browser work to ensure deferrals from the last chunk are
      // noticed.
      await flushBrowserWork();
    } finally {
      window.removeEventListener('error', recordError);
      window.removeEventListener('unhandledrejection', recordRejection);
    }

    expect(failures).toEqual([]);
  });
});
