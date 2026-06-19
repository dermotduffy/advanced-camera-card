import { z } from 'zod';

// HA accepts a boolean or a template string (rendered at runtime) for `enabled`
// (`vol.Any(boolean, template)`). Shared by the condition and trigger bases.
export const enabledSchema = z.boolean().or(z.string()).optional();
