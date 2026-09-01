import { z } from 'zod';

export const integrationManifestSchema = z
  .object({
    domain: z.string(),
    version: z.string().optional(),
  })
  .loose();
export type IntegrationManifest = z.infer<typeof integrationManifestSchema>;
