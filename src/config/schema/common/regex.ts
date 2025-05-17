import { z } from 'zod';

export const regexSchema = z.string().refine(
  (val) => {
    try {
      new RegExp(val);
    } catch {
      return false;
    }
    return true;
  },
  { message: 'Invalid regular expression' },
);
