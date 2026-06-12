import { z } from 'zod';

export const screenBaseSchema = z.object({
  // Optional, as in HA (a screen condition without a query simply never matches).
  media_query: z.string().optional(),
});
