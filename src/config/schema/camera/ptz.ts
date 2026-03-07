import { z } from 'zod';
import { performActionActionSchema } from '../actions/stock/perform-action';

export const ptzCameraConfigDefaults = {
  r2c_delay_between_calls_seconds: 0.5,
  c2r_delay_between_calls_seconds: 0.2,
};

// Converts WebRTC `data_*` shorthand keys into full `actions_*` perform-action
// objects (e.g. `data_start_left` → `actions_left_start`, `data_end_left` →
// `actions_left_stop`, `data_left` → `actions_left`, `data_home` → preset).
// See: https://github.com/AlexxIT/WebRTC/blob/master/custom_components/webrtc/www/webrtc-camera.js
const dataPTZFormatToFullFormat =
  (suffix: string) =>
  (data: unknown): unknown => {
    if (!data || typeof data !== 'object' || !data['service']) {
      return data;
    }

    const service = data['service'];
    const out = { ...data };

    for (const key of Object.keys(data)) {
      const webrtc = key.match(/^data_(start|end)_(.+)$/);
      const name = webrtc
        ? `${webrtc[2]}_${webrtc[1] === 'end' ? 'stop' : webrtc[1]}`
        : key.match(/^data_(.+)$/)?.[1];

      if (!name) {
        continue;
      }

      // Route `data_home` into a `home` preset listed first so the PTZ
      // home button (which activates the first preset) uses it.
      if (suffix && name === 'home') {
        const presets =
          out['presets'] && typeof out['presets'] === 'object' ? out['presets'] : {};
        if (!('home' in presets)) {
          out['presets'] = {
            home: {
              action: 'perform-action',
              perform_action: service,
              data: out[key],
            },
            ...presets,
          };
        }
      } else if (!(`${suffix}${name}` in out)) {
        out[`${suffix}${name}`] = {
          action: 'perform-action',
          perform_action: service,
          data: out[key],
        };
      }

      delete out[key];
      delete out['service'];
    }
    return out;
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
            z.record(z.string(), performActionActionSchema),

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
