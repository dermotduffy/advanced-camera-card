import { z } from 'zod';

export const initializedBaseSchema = z.object({
  // Matches the card having ever been initialized, rather than it being
  // initialized right now.
  //
  // Defaulted rather than optional so the trigger always carries a value. A
  // valueless trigger fires on any change of what it watches, which here would
  // include the card becoming uninitialized -- and an action fired then would
  // run against a card that has just been torn down.
  ever: z.boolean().default(false),
});
export type InitializedBase = z.infer<typeof initializedBaseSchema>;
