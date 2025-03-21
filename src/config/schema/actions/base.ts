import { z } from 'zod';
import { cardIDRegex } from '../common/const';

// https://www.home-assistant.io/dashboards/actions/#options-for-confirmation
export const actionBaseSchema = z.object({
  confirmation: z
    .boolean()
    .or(
      z.object({
        text: z.string().optional(),
        exemptions: z
          .object({
            user: z.string(),
          })
          .array()
          .optional(),
      }),
    )
    .optional(),

  card_id: z
    .string()
    .regex(cardIDRegex, 'card_id parameter can only contain [a-z][A-Z][0-9_]-')
    .optional(),
});
