/**
 * The literal the card carries in place of its version, for the build to
 * rewrite.
 *
 * `getReleaseVersion` cannot import this: it has to sit in that source as a
 * plain string for the build to have something to replace. It lives in its own
 * module because the build, the browser tests and a unit test all have to agree
 * on it, and none of them should have to depend on either of the others.
 *
 * It must be in a JS file as Node's loader cannot import TypeScript.
 */
export const RELEASE_VERSION_TOKEN = '__ADVANCED_CAMERA_CARD_RELEASE_VERSION__';
