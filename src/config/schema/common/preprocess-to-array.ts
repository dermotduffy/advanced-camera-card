import { z } from 'zod';

// Accept a single item where a list is expected and normalise it to a list,
// mirroring Home Assistant's `cv.ensure_list`. The schema output is always the
// list, so the rest of the code only ever sees the canonical form.
export const preprocessToArray = <T extends z.ZodTypeAny>(arraySchema: T) =>
  z.preprocess(
    (value) => (value === undefined || Array.isArray(value) ? value : [value]),
    arraySchema,
  );
