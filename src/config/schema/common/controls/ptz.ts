import { z } from 'zod';

export const PTZ_CONTROL_TYPES = ['buttons', 'gestures'] as const;
export type PTZControlType = (typeof PTZ_CONTROL_TYPES)[number];

export const ptzControlsDefaults = {
  orientation: 'horizontal' as const,
  mode: 'auto' as const,
  hide_pan_tilt: false,
  hide_zoom: false,
  hide_home: false,
  hide_type: false,
  position: 'bottom-right' as const,
  type: 'buttons' as const,
};

export const ptzControlsConfigSchema = z.object({
  mode: z.enum(['off', 'auto', 'on']).default(ptzControlsDefaults.mode),
  position: z
    .enum(['top-left', 'top-right', 'bottom-left', 'bottom-right'])
    .default(ptzControlsDefaults.position),
  orientation: z
    .enum(['vertical', 'horizontal'])
    .default(ptzControlsDefaults.orientation),

  hide_pan_tilt: z.boolean().default(ptzControlsDefaults.hide_pan_tilt),
  hide_zoom: z.boolean().default(ptzControlsDefaults.hide_zoom),
  hide_home: z.boolean().default(ptzControlsDefaults.hide_home),
  hide_type: z.boolean().default(ptzControlsDefaults.hide_type),

  type: z.enum(PTZ_CONTROL_TYPES).default(ptzControlsDefaults.type),

  style: z.looseObject({}).optional(),
});
export type PTZControlsConfig = z.infer<typeof ptzControlsConfigSchema>;
