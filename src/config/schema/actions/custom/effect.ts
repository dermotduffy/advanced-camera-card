import { z } from 'zod';
import { EffectName } from '../../../../types';
import { advancedCameraCardCustomActionsBaseSchema } from './base';

const effectNameSchema = z.enum([
  'check',
  'fireworks',
  'ghost',
  'hearts',
  'shamrocks',
  'snow',
]) satisfies z.ZodType<EffectName>;

const effectActionSchema = z.enum(['start', 'stop', 'toggle']);
export type EffectAction = z.infer<typeof effectActionSchema>;

export const effectActionConfigSchema = advancedCameraCardCustomActionsBaseSchema.extend(
  {
    advanced_camera_card_action: z.literal('effect'),
    effect: effectNameSchema,
    effect_action: effectActionSchema.default('toggle'),
  },
);

export type EffectActionConfig = z.infer<typeof effectActionConfigSchema>;
