/**
 * Writes the date of the build into the card.
 */

import type { Plugin } from 'vite';

// Strict length requirement: See below.
export const BUILD_DATE_PLACEHOLDER = '__BUILD_DATE_SENTINEL___';

/**
 * The date cannot be handed to the bundler as a substituted name, because the
 * build configuration is evaluated once and `vite build --watch` reuses it.
 * As such, every rebuild would report the time the watcher started rather than
 * the actual build time. Output is generated afresh for each build, so the date
 * is written here instead.
 */
export const buildDate = (): Plugin => ({
  name: 'build-date',

  renderChunk(code) {
    if (!code.includes(BUILD_DATE_PLACEHOLDER)) {
      return null;
    }

    const date = new Date().toISOString();
    if (date.length !== BUILD_DATE_PLACEHOLDER.length) {
      this.error(
        'The build date must be exactly as long as the placeholder it replaces.',
      );
    }

    return {
      code: code.replaceAll(BUILD_DATE_PLACEHOLDER, date),

      // The replacement is exactly as long as what it replaces, so the existing
      // sourcemap still describes the code.
      map: null,
    };
  },
});
