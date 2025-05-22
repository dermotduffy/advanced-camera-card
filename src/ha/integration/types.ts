import { z } from 'zod';

export const integrationManifestSchema = z
  .object({
    domain: z.string(),
    version: z.string().optional(),
  })
  .passthrough();
export type IntegrationManifest = z.infer<typeof integrationManifestSchema>;
