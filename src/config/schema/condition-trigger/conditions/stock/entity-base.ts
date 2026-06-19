import { z } from 'zod';
import { stringOrArray } from '../../../common/string-or-array';

// Shared by the stock `state`/`numeric_state` conditions: the card accepts both
// of HA's entity-field dialects (at least one of which is required). Either may
// be a single entity or a list.
export const entityConditionBaseSchema = z
  .object({
    // Picture-element / dashboard dialect (canonical in this card):
    // https://www.home-assistant.io/dashboards/picture-elements/#conditional-element
    entity: stringOrArray.optional(),

    // Automation dialect (accepted alias):
    // https://www.home-assistant.io/docs/scripts/conditions/
    entity_id: stringOrArray.optional(),
  })
  .refine(
    (data) => data.entity !== undefined || data.entity_id !== undefined,
    'A condition requires `entity` (or its `entity_id` alias)',
  );
