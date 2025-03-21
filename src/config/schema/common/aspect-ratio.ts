import { z } from 'zod';

export const aspectRatioSchema = z
  .number()
  .array()
  .length(2)
  .or(
    z
      .string()
      .regex(/^\s*\d+\.?\d*\s*[:/]\s*\d+\.?\d*\s*$/)
      .transform((input) => input.split(/[:\/]/).map((d) => Number(d))),
  );
