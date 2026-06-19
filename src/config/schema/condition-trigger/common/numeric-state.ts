import { z } from 'zod';

// HA `NUMERIC_STATE_THRESHOLD_SCHEMA`: a number, or an entity id whose state
// supplies the threshold value (e.g. compare against an
// input_number/number/sensor/zone in HA).
const thresholdSchema = z.number().or(z.string());

// Fields shared by the `numeric_state` condition AND trigger.
// (`entity`/`entity_id` live in the per-context entity bases; the
// ≥1-of-`above`/`below` rule is applied by each consumer, and the trigger adds
// `for`.)
export const numericStateBaseSchema = z.object({
  // Common to both of Home Assistant's dialects (automations & picture
  // elements):
  above: thresholdSchema.optional(),
  below: thresholdSchema.optional(),
  attribute: z.string().optional(),

  // HA automation field (not present in the picture-elements dialect), but
  // respected in both usecases in this card:
  // https://www.home-assistant.io/docs/scripts/conditions/#numeric-state-condition
  value_template: z.string().optional(),
});
export type NumericStateBase = z.infer<typeof numericStateBaseSchema>;

// HA requires at least one of `above`/`below` on a numeric_state condition or
// trigger. Shared as a predicate because `.shape` (used to merge this base into
// each schema) drops refinements, so the rule is re-applied by each consumer.
export const hasAboveOrBelow = (data: NumericStateBase): boolean =>
  data.above !== undefined || data.below !== undefined;

// HA's numeric_state TRIGGER rejects an impossible band where a literal `above`
// exceeds a literal `below`: the value can never be both, so the trigger could
// never fire (HA `validate_above_below`).
export const aboveNotGreaterThanBelow = (data: NumericStateBase): boolean =>
  typeof data.above !== 'number' ||
  typeof data.below !== 'number' ||
  data.above <= data.below;
