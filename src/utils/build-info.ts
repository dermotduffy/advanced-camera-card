declare const __ADVANCED_CAMERA_CARD_RELEASE_VERSION__: string | undefined;
declare const __ADVANCED_CAMERA_CARD_IS_RELEASE_BUILD__: boolean | undefined;
declare const __ADVANCED_CAMERA_CARD_GIT_HASH__: string | undefined;
declare const __ADVANCED_CAMERA_CARD_GIT_DATE__: string | undefined;
declare const __ADVANCED_CAMERA_CARD_BUILD_DATE__: string | undefined;

const DEVELOPMENT_VERSION = 'dev';

/* v8 ignore start: substituted by the build -- @preserve */
const RELEASE_VERSION =
  typeof __ADVANCED_CAMERA_CARD_RELEASE_VERSION__ === 'undefined'
    ? DEVELOPMENT_VERSION
    : __ADVANCED_CAMERA_CARD_RELEASE_VERSION__;

const GIT_HASH =
  typeof __ADVANCED_CAMERA_CARD_GIT_HASH__ === 'undefined'
    ? undefined
    : __ADVANCED_CAMERA_CARD_GIT_HASH__;

const GIT_DATE =
  typeof __ADVANCED_CAMERA_CARD_GIT_DATE__ === 'undefined'
    ? undefined
    : __ADVANCED_CAMERA_CARD_GIT_DATE__;

const BUILD_DATE =
  typeof __ADVANCED_CAMERA_CARD_BUILD_DATE__ === 'undefined'
    ? undefined
    : __ADVANCED_CAMERA_CARD_BUILD_DATE__;

const IS_RELEASE_BUILD =
  typeof __ADVANCED_CAMERA_CARD_IS_RELEASE_BUILD__ === 'undefined'
    ? false
    : __ADVANCED_CAMERA_CARD_IS_RELEASE_BUILD__;

const UNRELEASED_BUILD_DATE =
  !IS_RELEASE_BUILD && BUILD_DATE ? new Date(BUILD_DATE) : null;
/* v8 ignore stop -- @preserve */

export interface GitInfo {
  hash?: string;
  commitDate?: string;
  buildDate?: string;
}

export const getReleaseVersion = (): string => RELEASE_VERSION;
export const getUnreleasedBuildDate = (): Date | null => UNRELEASED_BUILD_DATE;

export const getGitInfo = (): GitInfo => ({
  hash: GIT_HASH,
  commitDate: GIT_DATE,
  buildDate: BUILD_DATE,
});
