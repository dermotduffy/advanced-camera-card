import { z } from 'zod';
import { advancedCameraCardCustomActionsBaseSchema } from './base';

const PTZ_PAN_TILT_ACTIONS = ['left', 'right', 'up', 'down'] as const;
const PTZ_ZOOM_ACTIONS = ['zoom_in', 'zoom_out'] as const;
const PTZ_BASE_ACTIONS = [...PTZ_PAN_TILT_ACTIONS, ...PTZ_ZOOM_ACTIONS] as const;
export type PTZBaseAction = (typeof PTZ_BASE_ACTIONS)[number];

// PTZ actions as used by the PTZ control (includes a 'home' button).
const PTZ_CONTROL_ACTIONS = [...PTZ_BASE_ACTIONS, 'home'] as const;
export type PTZControlAction = (typeof PTZ_CONTROL_ACTIONS)[number];

// PTZ actions as used by the camera manager (includes generic presets).
export const PTZ_ACTIONS = [...PTZ_BASE_ACTIONS, 'preset'] as const;
export type PTZAction = (typeof PTZ_ACTIONS)[number];

export const PTZ_ACTION_PHASES = ['start', 'stop'] as const;
export type PTZActionPhase = (typeof PTZ_ACTION_PHASES)[number];

export const ptzActionConfigSchema = advancedCameraCardCustomActionsBaseSchema.extend({
  advanced_camera_card_action: z.literal('ptz'),
  camera: z.string().optional(),
  ptz_action: z.enum(PTZ_ACTIONS).optional(),
  ptz_phase: z.enum(PTZ_ACTION_PHASES).optional(),
  ptz_preset: z.string().optional(),
});
export type PTZActionConfig = z.infer<typeof ptzActionConfigSchema>;
