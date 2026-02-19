import { HassServiceTarget } from 'home-assistant-js-websocket';
import { z } from 'zod';

export const targetSchema: z.ZodSchema<HassServiceTarget> = z.object({
  entity_id: z.union([z.string(), z.string().array()]).optional(),
  device_id: z.union([z.string(), z.string().array()]).optional(),
  area_id: z.union([z.string(), z.string().array()]).optional(),
  label_id: z.union([z.string(), z.string().array()]).optional(),
  floor_id: z.union([z.string(), z.string().array()]).optional(),
});
