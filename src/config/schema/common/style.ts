import { z } from 'zod';

// CSS declarations to apply to an element, e.g. `{ color: 'green' }`.
export const styleSchema = z.record(
  z.string(),
  z.string().nullable().or(z.undefined()).or(z.number()),
);
