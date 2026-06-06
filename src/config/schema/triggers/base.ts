import { z } from 'zod';

// Universal trigger fields. Current the card does not support
// `id`/`alias`/`variables` parameters (which HA does).
export const triggerBaseSchema = z.object({

  // HA accepts a boolean or a template string (rendered at runtime) for `enabled`.
  enabled: z.boolean().or(z.string()).optional(),
});
