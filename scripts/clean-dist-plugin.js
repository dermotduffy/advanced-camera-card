import { existsSync, readdirSync, rmSync } from 'node:fs';

/**
 * Rollup plugin: deletes prior build artifacts from `dist/` (which otherwise
 * accumulate stale hashed chunks that can be served in place of fresh output).
 * Deletes only top-level build artifacts by extension (no recursion), so
 * anything unexpected in `dist/` survives. Cleans once per process: watch mode
 * cleans at startup, not on every incremental rebuild.
 *
 * @type {() => import('rollup').Plugin}
 */
export const cleanDist = () => {
  let cleaned = false;
  return {
    name: 'clean-dist',
    buildStart() {
      if (cleaned) {
        return;
      }
      cleaned = true;
      const dist = new URL('../dist/', import.meta.url);
      if (!existsSync(dist)) {
        return;
      }
      for (const entry of readdirSync(dist, { withFileTypes: true })) {
        if (entry.isFile() && /\.js(\.map)?$/.test(entry.name)) {
          rmSync(new URL(entry.name, dist));
        }
      }
    },
  };
};
