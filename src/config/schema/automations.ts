import { z } from 'zod';
import { actionConfigSchema } from './actions/types';
import { conditionSchema } from './condition-trigger/conditions/types';

const automationActionsSchema = actionConfigSchema.array();
export type AutomationActions = z.infer<typeof automationActionsSchema>;

const automationSchema = z
  .object({
    conditions: conditionSchema.array(),
    actions: automationActionsSchema.optional(),
    actions_not: automationActionsSchema.optional(),
  })
  .refine(
    (data) => data.actions?.length || data.actions_not?.length,
    'Automations must include at least one action',
  );
export type Automation = z.infer<typeof automationSchema>;

export const automationsSchema = automationSchema.array();
