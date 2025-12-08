import { z } from 'zod';
import { Cache } from '../../../cache/cache';

const deviceSchema = z.object({
  id: z.string(),
  model: z.string().nullable(),
  config_entries: z.string().array(),
  manufacturer: z.string().nullable(),
  configuration_url: z.string().nullable().optional(),
});
export type Device = z.infer<typeof deviceSchema>;

export const deviceListSchema = deviceSchema.array();
export type DeviceList = z.infer<typeof deviceListSchema>;

export class DeviceCache extends Cache<string, Device> {}
