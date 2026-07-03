import {
  MEDIA_ACTION_POSITIVE_CONDITIONS,
  type AutoUnmuteCondition,
} from '../../config/schema/common/media-actions.js';

/**
 * Whether the configured auto-unmute policy will unmute a stream as it loads
 * (i.e. on selection or visibility), rather than only later in response to a
 * user action or call event. Used to decide whether to pre-select a camera's
 * audio-carrying stream up front instead of switching to it after the fact.
 */
export const isAudioIntendedOnLoad = (
  autoUnmute: readonly AutoUnmuteCondition[],
): boolean =>
  MEDIA_ACTION_POSITIVE_CONDITIONS.some((condition) => autoUnmute.includes(condition));
