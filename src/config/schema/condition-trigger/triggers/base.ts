import { z } from 'zod';

import { enabledSchema } from '../common/enabled';

// Universal trigger fields. Current the card does not support
// `id`/`alias`/`variables` parameters (which HA does).
export const triggerBaseSchema = z.object({
  enabled: enabledSchema,
});
