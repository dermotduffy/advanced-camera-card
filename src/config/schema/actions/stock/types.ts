import { z } from 'zod';
import { callServiceActionSchema } from './call-service';
import { customActionSchema } from './custom';
import { ifActionConfigSchema } from './if';
import { moreInfoActionSchema } from './more-info';
import { navigateActionSchema } from './navigate';
import { noneActionSchema } from './none';
import { performActionActionSchema } from './perform-action';
import { toggleActionSchema } from './toggle';
import { urlActionSchema } from './url';

export const stockActionSchema = z.union([
  callServiceActionSchema,
  customActionSchema,
  ifActionConfigSchema,
  moreInfoActionSchema,
  navigateActionSchema,
  noneActionSchema,
  performActionActionSchema,
  toggleActionSchema,
  urlActionSchema,
]);
