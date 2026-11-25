import { afterAll, beforeAll } from 'vitest';

import type { LeakCheck } from './types';

/**
 * Fails the current test file if it leaves behind any state the checks cover.
 */
export const registerLeakChecks = (checks: LeakCheck[]): void => {
  beforeAll(() => {
    checks.forEach((check) => check.start());
  });

  afterAll(() => {
    const lines = checks.flatMap((check) => {
      const leaks = check.finish();
      return leaks.length
        ? [`  ${check.description}:`, ...leaks.map((leak) => `    ${leak}`)]
        : [];
    });
    if (lines.length) {
      throw new Error(
        [
          'This test file left state behind that needs to be cleaned up:',
          ...lines,
          'Undo each change where it is made (e.g. with onTestFinished()).',
        ].join('\n'),
      );
    }
  });
};
