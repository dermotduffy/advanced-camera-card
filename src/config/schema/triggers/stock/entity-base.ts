import { z } from 'zod';
import { stringOrArray } from '../../common/string-or-array';

// Shared by the stock `state`/`numeric_state` conditions: the card accepts both
// of HA's entity-field dialects (at least one of which is required).
export const entityTriggerBaseSchema = z
  .object({
    // Automation dialect (canonical for Home Assistant triggers):
    // https://www.home-assistant.io/docs/scripts/conditions/
    entity_id: stringOrArray.optional(),

    // Picture element dialect (accepted alias). Allowed since it is canonical
    // in Home Assistant picture-elements / dashboard dialect (but not for
    // automations). Allowed as a card-specific extension to allow consistent
    // users to choose one or the other (or both).
    entity: stringOrArray.optional(),
  })
  .refine(
    (data) => data.entity !== undefined || data.entity_id !== undefined,
    'A trigger requires `entity` (or its `entity_id` alias)',
  );
