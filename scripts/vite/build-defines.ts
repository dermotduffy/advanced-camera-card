import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { BUILD_DATE_PLACEHOLDER } from './plugins/build-date.js';

/**
 * Asks git something or gives back nothing when it cannot be asked.
 */
const askGit = (...args: string[]): string => {
  try {
    return execFileSync('git', args, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
};

const getPackageVersion = (): string => {
  const contents: unknown = JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'),
  );
  if (
    typeof contents !== 'object' ||
    contents === null ||
    !('version' in contents) ||
    typeof contents.version !== 'string'
  ) {
    throw new Error('package.json must have a string version');
  }
  return contents.version;
};

interface BuildDefinesOptions {
  dev: boolean;
  releaseVersion?: string;
}

/**
 * What the build stamps into the card, as names for the bundler to substitute.
 *
 * `releaseVersion` is the version being released, which only the release
 * workflow knows; a build without one reports the version in `package.json`, or
 * a development build the commit it was made from. Its presence is what makes a
 * build a released one.
 *
 * The build date is a placeholder here, written in for by the `buildDate`
 * plugin as each build's output is generated.
 *
 * The values are JSON so that a bundler can drop them in as written.
 */
export const getBuildDefines = ({
  dev,
  releaseVersion,
}: BuildDefinesOptions): Record<string, string> => {
  const gitHash = askGit('rev-parse', '--short', 'HEAD');
  const developmentVersion = gitHash ? `dev+${gitHash}` : 'dev';

  return {
    __ADVANCED_CAMERA_CARD_RELEASE_VERSION__: JSON.stringify(
      releaseVersion ?? (dev ? developmentVersion : getPackageVersion()),
    ),
    __ADVANCED_CAMERA_CARD_IS_RELEASE_BUILD__: JSON.stringify(!!releaseVersion),
    __ADVANCED_CAMERA_CARD_GIT_HASH__: JSON.stringify(gitHash),
    __ADVANCED_CAMERA_CARD_GIT_DATE__: JSON.stringify(
      askGit('log', '-1', '--format=%cI'),
    ),
    __ADVANCED_CAMERA_CARD_BUILD_DATE__: JSON.stringify(BUILD_DATE_PLACEHOLDER),
  };
};
