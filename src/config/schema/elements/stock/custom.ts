import { z } from 'zod';

// https://www.home-assistant.io/dashboards/picture-elements/#custom-elements
export const customSchema = z
  .object({
    // Insist that Advanced Camera Card custom elements are handled by other schemas.
    type: z.string().superRefine((val, ctx) => {
      if (!val.match(/^custom:(?!advanced-camera-card).+/)) {
        ctx.addIssue({
          code: 'custom',
          message: 'advanced-camera-card custom elements must match specific schemas',
          fatal: true,
        });
      }
    }),
  })
  .loose();
