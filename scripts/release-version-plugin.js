import { RELEASE_VERSION_TOKEN } from './release-version.js';

// What the card substitutes to mean "the version in package.json". The
// development substitution is not used here because it appends a git hash that
// only a build step knows.
const PACKAGE_VERSION = 'pkg';

/**
 * Substitutes the release version the way the build does.
 *
 * The card reads it out of a string literal that Rollup rewrites, so without
 * this it renders the placeholder itself: the loading screen shows the raw
 * token, which then appears in every failure screenshot.
 */
export const releaseVersion = () => ({
  name: 'release-version',

  transform(code, id) {
    if (!id.includes('src/utils/diagnostics.ts')) {
      return null;
    }

    return { code: code.replace(RELEASE_VERSION_TOKEN, PACKAGE_VERSION), map: null };
  },
});
