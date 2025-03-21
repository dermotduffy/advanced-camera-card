import { z } from 'zod';
import { advancedCameraCardCustomActionsBaseSchema } from './base';

const GENERAL_ACTIONS = [
  'camera_ui',
  'default',
  'download',
  'expand',
  'fullscreen',
  'live_substream_off',
  'live_substream_on',
  'menu_toggle',
  'microphone_connect',
  'microphone_disconnect',
  'microphone_mute',
  'microphone_unmute',
  'mute',
  'pause',
  'play',
  'screenshot',
  'unmute',
] as const;
export type AdvancedCameraCardGeneralAction = (typeof GENERAL_ACTIONS)[number];

export const generalActionConfigSchema =
  advancedCameraCardCustomActionsBaseSchema.extend({
    advanced_camera_card_action: z.enum(GENERAL_ACTIONS),
  });
export type GeneralActionConfig = z.infer<typeof generalActionConfigSchema>;
