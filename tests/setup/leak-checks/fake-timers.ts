import { vi } from 'vitest';

import type { LeakCheck } from './types';

let installedAtStart = false;

export const fakeTimerLeakCheck: LeakCheck = {
  description: 'Fake timers still installed',
  start: () => {
    installedAtStart = vi.isFakeTimers();
  },
  finish: () =>
    !installedAtStart && vi.isFakeTimers()
      ? ['vi.useFakeTimers() with no matching vi.useRealTimers()']
      : [],
};
