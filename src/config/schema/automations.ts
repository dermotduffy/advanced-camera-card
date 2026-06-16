import { z } from 'zod';
import { actionConfigSchema } from './actions/types';
import { conditionSchema } from './condition-trigger/conditions/types';
import { triggerSchema } from './condition-trigger/triggers/types';

const automationActionsSchema = actionConfigSchema.array();
export type AutomationActions = z.infer<typeof automationActionsSchema>;

const automationSchema = z.object({
  triggers: triggerSchema.array().min(1),
  conditions: conditionSchema.array().optional(),
  actions: automationActionsSchema,
});
export type Automation = z.infer<typeof automationSchema>;

export const automationsSchema = automationSchema.array();
