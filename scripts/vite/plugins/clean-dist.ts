import { readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

import type { Plugin } from 'vite';

/**
 * Removes build artifacts an earlier build left behind, which otherwise accumulate
 * indefinitely as the hashed names change.
 *
 * Runs once the new output is on disk, and keeps whatever this build just
 * wrote, rather than emptying the directory beforehand. This ensures the card
 * is never briefly missing from a directory Home Assistant is potentially
 * serving out of. Only the build's own kind of file is removed, by extension
 * and without recursing, so anything else there survives.
 */
export const cleanDist = (): Plugin => ({
  name: 'clean-dist',

  writeBundle(options, bundle) {
    if (!options.dir) {
      return;
    }

    const written = new Set(Object.keys(bundle));

    for (const entry of readdirSync(options.dir, { withFileTypes: true })) {
      if (
        entry.isFile() &&
        /\.js(\.map)?$/.test(entry.name) &&
        !written.has(entry.name)
      ) {
        rmSync(path.resolve(options.dir, entry.name));
      }
    }
  },
});
