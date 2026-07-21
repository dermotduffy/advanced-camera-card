import type { HASelectSelectorOption } from '../../../../ha/types';
import { localize } from '../../../../localize/localize';

// A media-action condition option. `value` is the raw config enum value. The
// label key defaults to the value; `microphone`/`call` override it because
// their wording depends on mute vs unmute.
const condition = (value: string, labelKey: string = value): HASelectSelectorOption => ({
  value,
  label: localize(`config.common.media_action_conditions.${labelKey}`),
});

export const getMediaActionPositiveOptions = (): HASelectSelectorOption[] => [
  condition('selected'),
  condition('visible'),
];

export const getMediaActionNegativeOptions = (): HASelectSelectorOption[] => [
  condition('unselected'),
  condition('hidden'),
];

export const getLiveAutoMuteOptions = (): HASelectSelectorOption[] => [
  ...getMediaActionNegativeOptions(),
  condition('microphone', 'microphone_mute'),
  condition('call', 'call_mute'),
];

export const getLiveAutoUnmuteOptions = (): HASelectSelectorOption[] => [
  ...getMediaActionPositiveOptions(),
  condition('microphone', 'microphone_unmute'),
  condition('call', 'call_unmute'),
];

export const getMicrophoneMuteOptions = (): HASelectSelectorOption[] => [
  ...getMediaActionNegativeOptions(),
  condition('call', 'call_mute'),
];

export const getMicrophoneUnmuteOptions = (): HASelectSelectorOption[] => [
  ...getMediaActionPositiveOptions(),
  condition('call', 'call_unmute'),
];
