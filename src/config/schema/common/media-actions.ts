export const MEDIA_ACTION_POSITIVE_CONDITIONS = ['selected', 'visible'] as const;
export const MEDIA_ACTION_NEGATIVE_CONDITIONS = ['unselected', 'hidden'] as const;

export const MEDIA_MUTE_CONDITIONS = [
  ...MEDIA_ACTION_NEGATIVE_CONDITIONS,
  'microphone',
  'call',
] as const;

export const MEDIA_UNMUTE_CONDITIONS = [
  ...MEDIA_ACTION_POSITIVE_CONDITIONS,
  'microphone',
  'call',
] as const;

export const MICROPHONE_MUTE_CONDITIONS = [
  ...MEDIA_ACTION_NEGATIVE_CONDITIONS,
  'call',
] as const;

export const MICROPHONE_UNMUTE_CONDITIONS = [
  ...MEDIA_ACTION_POSITIVE_CONDITIONS,
  'call',
] as const;

export type AutoPlayCondition = (typeof MEDIA_ACTION_POSITIVE_CONDITIONS)[number];
export type AutoPauseCondition = (typeof MEDIA_ACTION_NEGATIVE_CONDITIONS)[number];
export type AutoMuteCondition = (typeof MEDIA_MUTE_CONDITIONS)[number];
export type AutoUnmuteCondition = (typeof MEDIA_UNMUTE_CONDITIONS)[number];

export type MicrophoneAutoMuteCondition = (typeof MICROPHONE_MUTE_CONDITIONS)[number];
export type MicrophoneAutoUnmuteCondition =
  (typeof MICROPHONE_UNMUTE_CONDITIONS)[number];

export type LazyUnloadCondition = (typeof MEDIA_ACTION_NEGATIVE_CONDITIONS)[number];
