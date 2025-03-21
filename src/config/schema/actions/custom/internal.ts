import { z } from 'zod';
import { advancedCameraCardCustomActionsBaseSchema } from './base';

// An action that can be used internally to call a callback (it is not possible
// for the user to pass this through via the configuration).
export const INTERNAL_CALLBACK_ACTION = '__INTERNAL_CALLBACK_ACTION__';
export const internalCallbackActionConfigSchema =
  advancedCameraCardCustomActionsBaseSchema.extend({
    advanced_camera_card_action: z.literal(INTERNAL_CALLBACK_ACTION),

    // The callback is expected to be called with a CardController API object.
    callback: z.function().args(z.any()).returns(z.promise(z.void())),
  });
export type InternalCallbackActionConfig = z.infer<
  typeof internalCallbackActionConfigSchema
>;
