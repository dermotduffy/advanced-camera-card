import { HassServiceTarget } from 'home-assistant-js-websocket';
import { z } from 'zod';

export const targetSchema: z.ZodSchema<HassServiceTarget, z.ZodTypeDef> = z.object({
  entity_id: z.string().or(z.string().array()).optional(),
  device_id: z.string().or(z.string().array()).optional(),
  area_id: z.string().or(z.string().array()).optional(),
  floor_id: z.string().or(z.string().array()).optional(),
  label_id: z.string().or(z.string().array()).optional(),
});
