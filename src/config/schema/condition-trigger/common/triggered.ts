import { z } from 'zod';

export const triggeredBaseSchema = z.object({
  // Matched against the set of currently-triggered cameras: omitted matches any
  // (the set is non-empty), a list matches when one of those cameras is in the
  // set, and `[]` matches when the set is empty (no camera triggered).
  triggered: z.string().array().optional(),
});
