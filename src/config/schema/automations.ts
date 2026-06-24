import { z } from 'zod';

import { isRecord } from '../../utils/basic';
import { actionConfigSchema } from './actions/types';
import { preprocessToArray } from './common/preprocess-to-array';
import { conditionSchema } from './condition-trigger/conditions/types';
import { triggerSchema } from './condition-trigger/triggers/types';

const automationActionsSchema = actionConfigSchema.array();
export type AutomationActions = z.infer<typeof automationActionsSchema>;

// Accept Home Assistant's singular `trigger`/`condition`/`action` keys,
// renaming each to the plural form used here (mirroring HA's `cv.renamed`).
// Conservative: a singular key is renamed only when its plural is absent.
const renameSingularKeys = (value: unknown): unknown => {
  if (!isRecord(value)) {
    return value;
  }
  const renamed = { ...value };
  for (const [singular, plural] of [
    ['trigger', 'triggers'],
    ['condition', 'conditions'],
    ['action', 'actions'],
  ] as const) {
    if (singular in renamed && !(plural in renamed)) {
      renamed[plural] = renamed[singular];
      delete renamed[singular];
    }
  }
  return renamed;
};

const automationSchema = z.preprocess(
  renameSingularKeys,
  z.object({
    triggers: preprocessToArray(triggerSchema.array().min(1)),
    conditions: preprocessToArray(conditionSchema.array()).optional(),
    actions: preprocessToArray(automationActionsSchema),
  }),
);
export type Automation = z.infer<typeof automationSchema>;

export const automationsSchema = automationSchema.array();
