import { z } from 'zod';

import type { CardActionsAPI } from '../../../../card-controller/types';
import type { TriggerData } from '../../../../condition-trigger/triggers/types';
import type { ActionConfig } from '../types';
import { advancedCameraCardCustomActionsBaseSchema } from './base';

interface GeneratedActionContext {
  api: CardActionsAPI;
  triggerData?: TriggerData;
}

// Returns the action(s) to run, or null to generate nothing.
export type ActionGenerator = (
  context: GeneratedActionContext,
) => ActionConfig | ActionConfig[] | null;

// An internal action (not user-configurable) that, when executed, generates and
// runs a concrete action
export const GENERATED_ACTION = '__GENERATED_ACTION__';
export const generatedActionConfigSchema =
  advancedCameraCardCustomActionsBaseSchema.extend({
    advanced_camera_card_action: z.literal(GENERATED_ACTION),

    // Validated with z.custom rather than z.function (which internal_callback's
    // callback uses) because the return type is an action config: typing it via
    // z.function would require importing actionConfigSchema from the module
    // that imports this one, a circular import.
    generator: z.custom<ActionGenerator>((value) => typeof value === 'function'),
  });
export type GeneratedActionConfig = z.infer<typeof generatedActionConfigSchema>;
