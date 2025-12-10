import { z } from 'zod';
import { capabilityKeys } from '../../types';
import { mediaLayoutConfigSchema } from './camera/media-layout';
import { ptzCameraConfigDefaults, ptzCameraConfigSchema } from './camera/ptz';
import { aspectRatioSchema } from './common/aspect-ratio';
import { imageBaseConfigSchema, imageConfigDefault } from './common/image';

const CAMERA_TRIGGER_EVENT_TYPES = [
  // An event whether or not it has any media yet associated with it.
  'events',

  // Specific media availability.
  'clips',
  'snapshots',
] as const;
export type CameraTriggerEventType = (typeof CAMERA_TRIGGER_EVENT_TYPES)[number];

// *************************************************************************
//                       Live Provider Configuration
// *************************************************************************

const LIVE_PROVIDERS = [
  'auto',
  'image',
  'ha',
  'jsmpeg',
  'go2rtc',
  'webrtc-card',
] as const;
export type LiveProvider = (typeof LIVE_PROVIDERS)[number];

const go2rtcConfigSchema = z.object({
  url: z
    .string()
    .transform((input) => input.replace(/\/+$/, ''))
    .optional(),
  host: z.string().optional(),
  modes: z.enum(['webrtc', 'mse', 'mp4', 'mjpeg']).array().optional(),
  stream: z.string().optional(),
});

const webrtcCardConfigSchema = z
  .object({
    entity: z.string().optional(),
    url: z.string().optional(),
  })
  .passthrough();

const jsmpegConfigSchema = z.object({
  options: z
    .object({
      // https://github.com/phoboslab/jsmpeg#usage
      audio: z.boolean().optional(),
      video: z.boolean().optional(),
      pauseWhenHidden: z.boolean().optional(),
      disableGl: z.boolean().optional(),
      disableWebAssembly: z.boolean().optional(),
      preserveDrawingBuffer: z.boolean().optional(),
      progressive: z.boolean().optional(),
      throttled: z.boolean().optional(),
      chunkSize: z.number().optional(),
      maxAudioLag: z.number().optional(),
      videoBufferSize: z.number().optional(),
      audioBufferSize: z.number().optional(),
    })
    .optional(),
});

// *************************************************************************
//                       Cast Configuration
// *************************************************************************

const castConfigDefault = {
  method: 'standard' as const,
};

const castSchema = z.object({
  method: z.enum(['standard', 'dashboard']).default(castConfigDefault.method).optional(),
  dashboard: z
    .object({
      dashboard_path: z.string().optional(),
      view_path: z.string().optional(),
    })
    .optional(),
});

// *************************************************************************
//                     Camera Configuration
// *************************************************************************

const ENGINES = [
  'auto',
  'frigate',
  'generic',
  'motioneye',
  'reolink',
  'tplink',
] as const;

export const cameraConfigDefault = {
  dependencies: {
    all_cameras: false,
    cameras: [],
  },
  engine: 'auto' as const,
  frigate: {
    client_id: 'frigate' as const,
  },
  live_provider: 'auto' as const,
  motioneye: {
    images: {
      directory_pattern: '%Y-%m-%d' as const,
      file_pattern: '%H-%M-%S' as const,
    },
    movies: {
      directory_pattern: '%Y-%m-%d' as const,
      file_pattern: '%H-%M-%S' as const,
    },
  },
  reolink: {
    media_resolution: 'low' as const,
  },
  ptz: ptzCameraConfigDefaults,
  triggers: {
    motion: false,
    occupancy: false,
    events: [...CAMERA_TRIGGER_EVENT_TYPES],
    entities: [],
  },
  proxy: {
    dynamic: true,
    live: 'auto' as const,
    media: 'auto' as const,
    ssl_ciphers: 'auto' as const,
    ssl_verification: 'auto' as const,
  },
  always_error_if_entity_unavailable: false,
};

const SSL_CIPHERS = ['default', 'insecure', 'intermediate', 'modern'] as const;
export type SSLCiphers = (typeof SSL_CIPHERS)[number];

const proxyConfigSchema = z.object({
  live: z.boolean().or(z.literal('auto')).default(cameraConfigDefault.proxy.live),
  media: z.boolean().or(z.literal('auto')).default(cameraConfigDefault.proxy.media),
  dynamic: z.boolean().default(cameraConfigDefault.proxy.dynamic),
  ssl_verification: z
    .boolean()
    .or(z.literal('auto'))
    .default(cameraConfigDefault.proxy.ssl_verification),
  ssl_ciphers: z
    .enum(SSL_CIPHERS)
    .or(z.literal('auto'))
    .default(cameraConfigDefault.proxy.ssl_ciphers),
});

const rotationSchema = z
  .literal(0)
  .or(z.literal(90))
  .or(z.literal(180))
  .or(z.literal(270));
export type Rotation = z.infer<typeof rotationSchema>;

const cameraDimensionsGridSchema = z.object({
  width_factor: z.number().min(0.1).optional(),
});

const cameraDimensionsSchema = z.object({
  aspect_ratio: aspectRatioSchema.optional(),
  layout: mediaLayoutConfigSchema.optional(),
  rotation: rotationSchema.optional(),
  grid: cameraDimensionsGridSchema.optional(),
});
export type CameraDimensionsConfig = z.infer<typeof cameraDimensionsSchema>;

export const cameraConfigSchema = z
  .object({
    camera_entity: z.string().optional(),

    // Used for presentation in the UI (autodetected from the entity if
    // specified).
    icon: z.string().optional(),
    title: z.string().optional(),

    capabilities: z
      .object({
        disable: z.enum(capabilityKeys).array().optional(),
        disable_except: z.enum(capabilityKeys).array().optional(),
      })
      .optional(),

    // Optional identifier to separate different camera configurations used in
    // this card.
    id: z.string().optional(),

    dependencies: z
      .object({
        all_cameras: z.boolean().default(cameraConfigDefault.dependencies.all_cameras),
        cameras: z.string().array().default(cameraConfigDefault.dependencies.cameras),
      })
      .default(cameraConfigDefault.dependencies),

    triggers: z
      .object({
        motion: z.boolean().default(cameraConfigDefault.triggers.motion),
        occupancy: z.boolean().default(cameraConfigDefault.triggers.occupancy),
        entities: z.string().array().default(cameraConfigDefault.triggers.entities),
        events: z
          .enum(CAMERA_TRIGGER_EVENT_TYPES)
          .array()
          .default(cameraConfigDefault.triggers.events),
      })
      .default(cameraConfigDefault.triggers),

    // Engine options.
    engine: z.enum(ENGINES).default('auto'),
    frigate: z
      .object({
        url: z.string().optional(),
        client_id: z.string().default(cameraConfigDefault.frigate.client_id),
        camera_name: z.string().optional(),
        labels: z.string().array().optional(),
        zones: z.string().array().optional(),
      })
      .default(cameraConfigDefault.frigate),
    motioneye: z
      .object({
        url: z.string().optional(),
        images: z
          .object({
            directory_pattern: z
              .string()
              .includes('%')
              .default(cameraConfigDefault.motioneye.images.directory_pattern),
            file_pattern: z
              .string()
              .includes('%')
              .default(cameraConfigDefault.motioneye.images.file_pattern),
          })
          .default(cameraConfigDefault.motioneye.images),
        movies: z
          .object({
            directory_pattern: z
              .string()
              .includes('%')
              .default(cameraConfigDefault.motioneye.movies.directory_pattern),
            file_pattern: z
              .string()
              .includes('%')
              .default(cameraConfigDefault.motioneye.movies.file_pattern),
          })
          .default(cameraConfigDefault.motioneye.movies),
      })
      .default(cameraConfigDefault.motioneye),
    reolink: z
      .object({
        url: z.string().optional(),
        media_resolution: z
          .enum(['high', 'low'])
          .default(cameraConfigDefault.reolink.media_resolution),
      })
      .default(cameraConfigDefault.reolink),

    // Live provider options.
    live_provider: z.enum(LIVE_PROVIDERS).default(cameraConfigDefault.live_provider),
    go2rtc: go2rtcConfigSchema.optional(),
    image: imageBaseConfigSchema.optional().default(imageConfigDefault),
    jsmpeg: jsmpegConfigSchema.optional(),
    webrtc_card: webrtcCardConfigSchema.optional(),

    cast: castSchema.optional(),

    ptz: ptzCameraConfigSchema.default(cameraConfigDefault.ptz),

    dimensions: cameraDimensionsSchema.optional(),

    proxy: proxyConfigSchema.default(cameraConfigDefault.proxy),

    // See: https://github.com/dermotduffy/advanced-camera-card/issues/1650
    always_error_if_entity_unavailable: z
      .boolean()
      .default(cameraConfigDefault.always_error_if_entity_unavailable),
  })
  .default(cameraConfigDefault);
export type CameraConfig = z.infer<typeof cameraConfigSchema>;

// Avoid using .nonempty() to avoid changing the inferred type
// (https://github.com/colinhacks/zod#minmaxlength).
export const camerasConfigSchema = cameraConfigSchema.array().min(1);
export type CamerasConfig = z.infer<typeof camerasConfigSchema>;
