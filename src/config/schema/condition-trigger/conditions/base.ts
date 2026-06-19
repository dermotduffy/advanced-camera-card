import { z } from 'zod';
import { enabledSchema } from '../common/enabled';

export const conditionBaseSchema = z.object({
  enabled: enabledSchema,
});
