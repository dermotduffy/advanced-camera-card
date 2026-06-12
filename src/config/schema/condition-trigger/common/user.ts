import { z } from 'zod';

export const userBaseSchema = z.object({
  // Optional, as in HA (no users simply matches no one).
  users: z.string().array().optional(),
});
