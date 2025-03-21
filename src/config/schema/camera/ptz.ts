import { z } from 'zod';
import { performActionActionSchema } from '../actions/stock/perform-action';

export const ptzCameraConfigDefaults = {
  r2c_delay_between_calls_seconds: 0.5,
  c2r_delay_between_calls_seconds: 0.2,
};

// To avoid lots of YAML duplication, provide an easy way to just specify the
// service data as actions for each PTZ action, and it will be preprocessed
// into the full form. This also provides compatability with the AlexIT/WebRTC
// PTZ configuration.
const dataPTZFormatToFullFormat = function (suffix: string): (data: unknown) => unknown {
  return (data) => {
    if (!data || typeof data !== 'object' || !data['service']) {
      return data;
    }
    const out = { ...data };
    Object.keys(data).forEach((key) => {
      const match = key.match(/^data_(.+)$/);
      const name = match?.[1];
      if (name && !(`${suffix}${name}` in data)) {
        out[`${suffix}${name}`] = {
          action: 'perform-action',
          perform_action: data['service'],
          data: data[key],
        };
        delete out[key];
        delete out['service'];
      }
    });
    return out;
  };
};

export const ptzCameraConfigSchema = z.preprocess(
  dataPTZFormatToFullFormat('actions_'),
  z
    .object({
      actions_left: performActionActionSchema.optional(),
      actions_left_start: performActionActionSchema.optional(),
      actions_left_stop: performActionActionSchema.optional(),

      actions_right: performActionActionSchema.optional(),
      actions_right_start: performActionActionSchema.optional(),
      actions_right_stop: performActionActionSchema.optional(),

      actions_up: performActionActionSchema.optional(),
      actions_up_start: performActionActionSchema.optional(),
      actions_up_stop: performActionActionSchema.optional(),

      actions_down: performActionActionSchema.optional(),
      actions_down_start: performActionActionSchema.optional(),
      actions_down_stop: performActionActionSchema.optional(),

      actions_zoom_in: performActionActionSchema.optional(),
      actions_zoom_in_start: performActionActionSchema.optional(),
      actions_zoom_in_stop: performActionActionSchema.optional(),

      actions_zoom_out: performActionActionSchema.optional(),
      actions_zoom_out_start: performActionActionSchema.optional(),
      actions_zoom_out_stop: performActionActionSchema.optional(),

      // The number of seconds between subsequent relative calls when converting a
      // relative request into a continuous request.
      r2c_delay_between_calls_seconds: z
        .number()
        .default(ptzCameraConfigDefaults.r2c_delay_between_calls_seconds),

      // The number of seconds between the start/stop call when converting a
      // continuous request into a relative request.
      c2r_delay_between_calls_seconds: z
        .number()
        .default(ptzCameraConfigDefaults.c2r_delay_between_calls_seconds),

      presets: z
        .preprocess(
          dataPTZFormatToFullFormat(''),
          z.union([
            z.record(performActionActionSchema),

            // This is used by the data_ style of action.
            z.object({ service: z.string().optional() }),
          ]),
        )
        .optional(),

      // This is used by the data_ style of action.
      service: z.string().optional(),
    })
    // We allow passthrough as there may be user-configured presets as "actions_<preset>" .
    .passthrough(),
);
