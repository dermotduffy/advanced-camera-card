import { z } from 'zod';
import { userAgentBaseSchema } from '../../common/user-agent';
import { conditionBaseSchema } from '../base';

export const userAgentConditionSchema = userAgentBaseSchema
  .extend(conditionBaseSchema.shape)
  .extend({
    condition: z.literal('user_agent'),
  })
  // With no field set a `user_agent` condition matches every user agent (always
  // true), which is useless; require at least one constraint.
  .refine(
    (data) =>
      data.user_agent !== undefined ||
      data.user_agent_re !== undefined ||
      data.casting !== undefined ||
      data.companion !== undefined,
    'A `user_agent` condition requires at least one of `user_agent`/`user_agent_re`/`casting`/`companion`',
  );
