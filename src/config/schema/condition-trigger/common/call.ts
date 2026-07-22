import { z } from 'zod';

// The lifecycle of a two-way audio call. An outbound call has no `ringing`
// phase: it is answered by construction.
const callPhaseSchema = z.enum(['idle', 'ringing', 'answered']);
export type CallPhase = z.infer<typeof callPhaseSchema>;

// Matches a single phase, or any one of a list of them.
export const callPhaseMatchSchema = callPhaseSchema.or(callPhaseSchema.array());

export const callBaseSchema = z.object({
  call: callPhaseMatchSchema.optional(),
});
export type CallBase = z.infer<typeof callBaseSchema>;
