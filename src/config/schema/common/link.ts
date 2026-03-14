import { z } from 'zod';

export const linkSchema = z.object({
  url: z.string(),
  title: z.string(),
});
export type Link = z.infer<typeof linkSchema>;
