import { z } from 'zod';

export const iconSchema = z.object({
  // MDI icon name (e.g. 'mdi:star').
  icon: z.string().optional(),

  // HA entity whose icon will be used when `icon` is not set.
  entity: z.string().optional(),

  // Whether to tint the icon color based on the entity's state.
  stateColor: z.boolean().optional(),
});
export type Icon = z.infer<typeof iconSchema>;

// Extended internally to include a fallback icon that is not user-configurable.
export interface InternalIcon extends Icon {
  fallback?: string;
}
