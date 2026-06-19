import { z } from 'zod';

// A value that may be a single string or a list of strings — common across HA
// condition/trigger fields (e.g. `state`, `to`, `entity_id`).
export const stringOrArray = z.string().or(z.string().array());
