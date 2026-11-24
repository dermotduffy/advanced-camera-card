import type { BrowserCommand } from 'vitest/node';

type ReducedMotion = 'reduce' | 'no-preference' | null;

/**
 * Browser settings that a page cannot change itself, which Playwright changes
 * for the page under test.
 */
export const browserCommands: Record<string, BrowserCommand<[ReducedMotion]>> = {
  // `null` drops the emulation, restoring the browser's own preference.
  emulateReducedMotion: async (context, reducedMotion) => {
    await context.page.emulateMedia({ reducedMotion });
  },
};
