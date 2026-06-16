import { z } from 'zod';
import { Condition, conditionSchema } from '../../condition-trigger/conditions/types';
import { actionBaseSchema } from '../base';
import { ActionConfig, actionConfigSchema } from '../types';

// HA `if`/`then`/`else` script action: unlike most actions this has no
// `action:` key, and is identified by the presence of an `if` key.
// `then`/`else` recurse into actions, so z.lazy() breaks the cycle.
export type IfActionConfig = z.infer<typeof actionBaseSchema> & {
  if: Condition[];
  then: ActionConfig[];
  else?: ActionConfig[];
};
export const ifActionConfigSchema: z.ZodSchema<IfActionConfig> = actionBaseSchema.extend(
  {
    if: conditionSchema.array(),
    then: z.lazy(() => actionConfigSchema).array(),
    else: z
      .lazy(() => actionConfigSchema)
      .array()
      .optional(),
  },
);
