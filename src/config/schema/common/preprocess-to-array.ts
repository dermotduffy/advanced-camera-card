import { z } from 'zod';

import { arrayify } from '../../../utils/basic';

// Normalise a single item to an array like Home Assistant's `cv.ensure_list` (a
// key written with no value is a list of nothing). The schema output is always
// the list, so the rest of the code only ever sees the canonical form. An
// absent value is passed through so that an optional field stays absent rather
// than becoming an empty list.
//
// For a list of strings use `stringOrArray` instead, which keeps the falsy
// values `arrayify` drops.
export const preprocessToArray = <T extends z.ZodTypeAny>(arraySchema: T) =>
  z.preprocess((value) => (value === undefined ? value : arrayify(value)), arraySchema);
