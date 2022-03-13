import { StyleInfo } from 'lit/directives/style-map.js';
import {
  CallServiceActionConfig,
  CustomActionConfig,
  LovelaceCard,
  LovelaceCardEditor,
  MoreInfoActionConfig,
  NavigateActionConfig,
  NoActionConfig,
  ToggleActionConfig,
  UrlActionConfig,
} from 'custom-card-helpers';
import { z } from 'zod';

import { deepRemoveDefaults } from './zod-util';

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-editor': LovelaceCardEditor;
    'hui-error-card': LovelaceCard;
  }
}

/**
 * Internal types.
 */

const FRIGATE_CARD_VIEWS_USER_SPECIFIED = [
  'live',     // Live view.
  'clip',     // Most recent clip.
  'clips',    // Clips gallery.
  'snapshot', // Most recent snapshot.
  'snapshots',// Snapshots gallery.
  'image',    // Static image.
  'timeline', // Event timeline.
] as const;

export type FrigateCardView = typeof FRIGATE_CARD_VIEWS_USER_SPECIFIED[number];

const FRIGATE_MENU_MODES = [
  'none',
  'hidden-top',
  'hidden-left',
  'hidden-bottom',
  'hidden-right',
  'overlay-top',
  'overlay-left',
  'overlay-bottom',
  'overlay-right',
  'hover-top',
  'hover-left',
  'hover-bottom',
  'hover-right',
  'above',
  'below',
] as const;
const LIVE_PROVIDERS = ['auto', 'ha', 'frigate-jsmpeg', 'webrtc-card'] as const;
export type LiveProvider = typeof LIVE_PROVIDERS[number];

export class FrigateCardError extends Error {}

/**
 * Action Types (for "Picture Elements" / Menu)
 */

// Declare schemas to existing types:
// - https://github.com/colinhacks/zod/issues/372#issuecomment-826380330
const schemaForType =
  <T>() =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <S extends z.ZodType<T, any, any>>(arg: S) => {
    return arg;
  };
const toggleActionSchema = schemaForType<ToggleActionConfig>()(
  z.object({
    action: z.literal('toggle'),
  }),
);
const callServiceActionSchema = schemaForType<CallServiceActionConfig>()(
  z.object({
    action: z.literal('call-service'),
    service: z.string(),
    service_data: z.object({}).passthrough().optional(),
  }),
);
const navigateActionSchema = schemaForType<NavigateActionConfig>()(
  z.object({
    action: z.literal('navigate'),
    navigation_path: z.string(),
  }),
);
const urlActionSchema = schemaForType<UrlActionConfig>()(
  z.object({
    action: z.literal('url'),
    url_path: z.string(),
  }),
);
const moreInfoActionSchema = schemaForType<MoreInfoActionConfig>()(
  z.object({
    action: z.literal('more-info'),
  }),
);
const customActionSchema = schemaForType<CustomActionConfig>()(
  z.object({
    action: z.literal('fire-dom-event'),
  }),
);
const noActionSchema = schemaForType<NoActionConfig>()(
  z.object({
    action: z.literal('none'),
  }),
);

const frigateCardCustomActionBaseSchema = customActionSchema.extend({
  // Syntactic sugar to avoid 'fire-dom-event' as part of an external API.
  action: z
    .literal('custom:frigate-card-action')
    .transform((): 'fire-dom-event' => 'fire-dom-event')
    .or(z.literal('fire-dom-event')),
});

const FRIGATE_CARD_GENERAL_ACTIONS = [
  'default',
  'clip',
  'clips',
  'image',
  'live',
  'snapshot',
  'snapshots',
  'download',
  'frigate_ui',
  'fullscreen',
  'menu_toggle',
] as const;
const FRIGATE_CARD_ACTIONS = [...FRIGATE_CARD_GENERAL_ACTIONS, 'camera_select'] as const;
export type FrigateCardAction = typeof FRIGATE_CARD_ACTIONS[number];

const frigateCardGeneralActionSchema = frigateCardCustomActionBaseSchema.extend({
  frigate_card_action: z.enum(FRIGATE_CARD_GENERAL_ACTIONS),
});
const frigateCardCameraSelectActionSchema = frigateCardCustomActionBaseSchema.extend({
  frigate_card_action: z.literal('camera_select'),
  camera: z.string(),
});
export const frigateCardCustomActionSchema = z.union([
  frigateCardGeneralActionSchema,
  frigateCardCameraSelectActionSchema,
]);
export type FrigateCardCustomAction = z.infer<typeof frigateCardCustomActionSchema>;

// Cannot use discriminatedUnion since frigateCardCustomActionSchema uses a
// transform on the discriminated union key.
const actionSchema = z.union([
  toggleActionSchema,
  callServiceActionSchema,
  navigateActionSchema,
  urlActionSchema,
  moreInfoActionSchema,
  noActionSchema,
  frigateCardCustomActionSchema,
]);
export type ActionType = z.infer<typeof actionSchema>;

const actionBaseSchema = z
  .object({
    tap_action: actionSchema.or(actionSchema.array()).optional(),
    hold_action: actionSchema.or(actionSchema.array()).optional(),
    double_tap_action: actionSchema.or(actionSchema.array()).optional(),
    start_tap_action: actionSchema.or(actionSchema.array()).optional(),
    end_tap_action: actionSchema.or(actionSchema.array()).optional(),
  })
  // Passthrough to allow (at least) entity/camera_image to go through. This
  // card doesn't need these attributes, but handleAction() in
  // custom_card_helpers may depending on how the action is configured.
  .passthrough();
export type Actions = z.infer<typeof actionBaseSchema>;
export type ActionsConfig = Actions & {
  camera_image?: string;
  entity?: string;
};

const actionsSchema = z.object({
  actions: actionBaseSchema.optional(),
});

const elementsBaseSchema = actionBaseSchema.extend({
  style: z.object({}).passthrough().optional(),
  title: z.string().nullable().optional(),
});

/**
 * Picture Element Configuration.
 *
 * All picture element types are validated (not just the Frigate card custom
 * ones) as a convenience to present the user with a consistent error display
 * up-front regardless of where they made their error.
 */

// https://www.home-assistant.io/lovelace/picture-elements/#state-badge
const stateBadgeIconSchema = elementsBaseSchema.extend({
  type: z.literal('state-badge'),
  entity: z.string(),
});

// https://www.home-assistant.io/lovelace/picture-elements/#state-icon
const stateIconSchema = elementsBaseSchema.extend({
  type: z.literal('state-icon'),
  entity: z.string(),
  icon: z.string().optional(),
  state_color: z.boolean().default(true),
});

// https://www.home-assistant.io/lovelace/picture-elements/#state-label
const stateLabelSchema = elementsBaseSchema.extend({
  type: z.literal('state-label'),
  entity: z.string(),
  attribute: z.string().optional(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
});

// https://www.home-assistant.io/lovelace/picture-elements/#service-call-button
const serviceCallButtonSchema = elementsBaseSchema.extend({
  type: z.literal('service-button'),
  // Title is required for service button.
  title: z.string(),
  service: z.string(),
  service_data: z.object({}).passthrough().optional(),
});

// https://www.home-assistant.io/lovelace/picture-elements/#icon-element
const iconSchema = elementsBaseSchema.extend({
  type: z.literal('icon'),
  icon: z.string(),
  entity: z.string().optional(),
});

// https://www.home-assistant.io/lovelace/picture-elements/#image-element
const imageSchema = elementsBaseSchema.extend({
  type: z.literal('image'),
  entity: z.string().optional(),
  image: z.string().optional(),
  camera_image: z.string().optional(),
  camera_view: z.string().optional(),
  state_image: z.object({}).passthrough().optional(),
  filter: z.string().optional(),
  state_filter: z.object({}).passthrough().optional(),
  aspect_ratio: z.string().optional(),
});

// https://www.home-assistant.io/lovelace/picture-elements/#image-element
const conditionalSchema = z.object({
  type: z.literal('conditional'),
  conditions: z
    .object({
      entity: z.string(),
      state: z.string().optional(),
      state_not: z.string().optional(),
    })
    .array(),
  elements: z.lazy(() => pictureElementsSchema),
});

// https://www.home-assistant.io/lovelace/picture-elements/#custom-elements
const customSchema = z
  .object({
    // Insist that Frigate card custom elements are handled by other schemas.
    type: z.string().superRefine((val, ctx) => {
      if (!val.match(/^custom:(?!frigate-card).+/)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Frigate-card custom elements must match specific schemas',
          fatal: true,
        });
      }
    }),
  })
  .passthrough();

/**
 * Camera configuration section
 */
export const cameraConfigDefault = {
  client_id: 'frigate' as const,
  live_provider: 'auto' as const,
};
const webrtcCardCameraConfigSchema = z.object({
  entity: z.string().optional(),
  url: z.string().optional(),
});
const cameraConfigSchema = z
  .object({
    // No URL validation to allow relative URLs within HA (e.g. Frigate addon).
    frigate_url: z.string().optional(),
    client_id: z.string().default(cameraConfigDefault.client_id),
    camera_name: z.string().optional(),
    label: z.string().optional(),
    zone: z.string().optional(),
    camera_entity: z.string().optional(),
    live_provider: z.enum(LIVE_PROVIDERS).default(cameraConfigDefault.live_provider),

    // Used for presentation in the UI (autodetected from the entity if
    // specified).
    icon: z.string().optional(),
    title: z.string().optional(),

    // Optional identifier to separate different camera configurations used in
    // this card.
    id: z.string().optional(),

    // Camera identifiers for WebRTC.
    webrtc_card: webrtcCardCameraConfigSchema.optional(),
  })
  .default(cameraConfigDefault);
export type CameraConfig = z.infer<typeof cameraConfigSchema>;

/**
 * Custom Element Types.
 */

export const menuIconSchema = iconSchema.extend({
  type: z.literal('custom:frigate-card-menu-icon'),
});
export type MenuIcon = z.infer<typeof menuIconSchema>;

export const menuStateIconSchema = stateIconSchema.extend({
  type: z.literal('custom:frigate-card-menu-state-icon'),
});
export type MenuStateIcon = z.infer<typeof menuStateIconSchema>;

const menuSubmenuItemSchema = elementsBaseSchema.extend({
  entity: z.string().optional(),
  icon: z.string().optional(),
  state_color: z.boolean().default(true),
  selected: z.boolean().default(false),
});
export type MenuSubmenuItem = z.infer<typeof menuSubmenuItemSchema>;

export const menuSubmenuSchema = iconSchema.extend({
  type: z.literal('custom:frigate-card-menu-submenu'),
  items: menuSubmenuItemSchema.array(),
});
export type MenuSubmenu = z.infer<typeof menuSubmenuSchema>;

const frigateCardConditionSchema = z.object({
  view: z.string().array().optional(),
  fullscreen: z.boolean().optional(),
  camera: z.string().array().optional(),
});
export type FrigateCardCondition = z.infer<typeof frigateCardConditionSchema>;

const frigateConditionalSchema = z.object({
  type: z.literal('custom:frigate-card-conditional'),
  conditions: frigateCardConditionSchema,
  elements: z.lazy(() => pictureElementsSchema),
});
export type FrigateConditional = z.infer<typeof frigateConditionalSchema>;

// Cannot use discriminatedUnion since customSchema uses a superRefine, which
// causes false rejections.
const pictureElementSchema = z.union([
  menuStateIconSchema,
  menuIconSchema,
  menuSubmenuSchema,
  frigateConditionalSchema,
  stateBadgeIconSchema,
  stateIconSchema,
  stateLabelSchema,
  serviceCallButtonSchema,
  iconSchema,
  imageSchema,
  conditionalSchema,
  customSchema,
]);
export type PictureElement = z.infer<typeof pictureElementSchema>;

const pictureElementsSchema = pictureElementSchema.array().optional();
export type PictureElements = z.infer<typeof pictureElementsSchema>;

/**
 * View configuration section.
 */
const viewConfigDefault = {
  default: 'live' as const,
  camera_select: 'current' as const,
  timeout_seconds: 300,
  update_seconds: 0,
  update_force: false,
  update_cycle_camera: false,
};
const viewConfigSchema = z
  .object({
    default: z
      .enum(FRIGATE_CARD_VIEWS_USER_SPECIFIED)
      .default(viewConfigDefault.default),
    camera_select: z
      .enum([...FRIGATE_CARD_VIEWS_USER_SPECIFIED, 'current'])
      .default(viewConfigDefault.camera_select),
    timeout_seconds: z.number().default(viewConfigDefault.timeout_seconds),
    update_seconds: z.number().default(viewConfigDefault.update_seconds),
    update_force: z.boolean().default(viewConfigDefault.update_force),
    update_cycle_camera: z.boolean().default(viewConfigDefault.update_cycle_camera),
    update_entities: z.string().array().optional(),
    render_entities: z.string().array().optional(),
  })
  .merge(actionsSchema)
  .default(viewConfigDefault);

/**
 * Image view configuration section.
 */

export const IMAGE_MODES = ['screensaver', 'camera', 'url'] as const;
const imageConfigDefault = {
  mode: 'url' as const,
  refresh_seconds: 0,
};
const imageConfigSchema = z
  .object({
    mode: z.enum(IMAGE_MODES).default(imageConfigDefault.mode),
    url: z.string().optional(),
    refresh_seconds: z.number().min(0).default(imageConfigDefault.refresh_seconds),
  })
  .merge(actionsSchema)
  .default(imageConfigDefault);
export type ImageViewConfig = z.infer<typeof imageConfigSchema>;

/**
 * Thumbnail controls configuration section.
 */

const thumbnailsControlSchema = z.object({
  mode: z.enum(['none', 'above', 'below']),
  size: z.string().optional(),
});
export type ThumbnailsControlConfig = z.infer<typeof thumbnailsControlSchema>;

/**
 * Next/Previous Control configuration section.
 */

const nextPreviousControlConfigSchema = z.object({
  style: z.enum(['none', 'chevrons', 'icons', 'thumbnails']),
  size: z.string(),
});
export type NextPreviousControlConfig = z.infer<typeof nextPreviousControlConfigSchema>;

/**
 * Carousel transition effect configuration.
 */
const transitionEffectConfigSchema = z.enum(['none', 'slide']);
export type TransitionEffect = z.infer<typeof transitionEffectConfigSchema>;

/**
 * Title Control configuration section.
 */
const titleControlConfigSchema = z.object({
  mode: z.enum([
    'none',
    'popup-top-right',
    'popup-top-left',
    'popup-bottom-right',
    'popup-bottom-left',
  ]),
  duration_seconds: z.number().min(0).max(60),
});
export type TitleControlConfig = z.infer<typeof titleControlConfigSchema>;

/**
 * Live view configuration section.
 */
const liveConfigDefault = {
  auto_unmute: false,
  preload: false,
  lazy_load: true,
  lazy_unload: false,
  draggable: true,
  transition_effect: 'slide' as const,
  controls: {
    next_previous: {
      size: '48px',
      style: 'chevrons' as const,
    },
    thumbnails: {
      media: 'clips' as const,
      size: '100px',
      mode: 'none' as const,
    },
    title: {
      mode: 'popup-bottom-right' as const,
      duration_seconds: 2,
    },
  },
};

const webrtcCardConfigSchema = webrtcCardCameraConfigSchema.passthrough().optional();
export type WebRTCCardConfig = z.infer<typeof webrtcCardConfigSchema>;

const jsmpegConfigSchema = z
  .object({
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
  })
  .optional();
export type JSMPEGConfig = z.infer<typeof jsmpegConfigSchema>;

const liveOverridableConfigSchema = z
  .object({
    webrtc_card: webrtcCardConfigSchema,
    jsmpeg: jsmpegConfigSchema,
    controls: z
      .object({
        next_previous: nextPreviousControlConfigSchema
          .extend({
            // Live cannot show thumbnails, remove that option.
            style: z
              .enum(['none', 'chevrons', 'icons'])
              .default(liveConfigDefault.controls.next_previous.style),
            size: nextPreviousControlConfigSchema.shape.size.default(
              liveConfigDefault.controls.next_previous.size,
            ),
          })
          .default(liveConfigDefault.controls.next_previous),
        thumbnails: thumbnailsControlSchema
          .extend({
            mode: thumbnailsControlSchema.shape.mode.default(
              liveConfigDefault.controls.thumbnails.mode,
            ),
            size: thumbnailsControlSchema.shape.size.default(
              liveConfigDefault.controls.thumbnails.size,
            ),
            media: z
              .enum(['clips', 'snapshots'])
              .default(liveConfigDefault.controls.thumbnails.media),
          })
          .default(liveConfigDefault.controls.thumbnails),
        title: titleControlConfigSchema
          .extend({
            mode: titleControlConfigSchema.shape.mode.default(
              liveConfigDefault.controls.title.mode,
            ),
            duration_seconds: titleControlConfigSchema.shape.duration_seconds.default(
              liveConfigDefault.controls.title.duration_seconds,
            ),
          })
          .default(liveConfigDefault.controls.title),
      })
      .default(liveConfigDefault.controls),
  })
  .merge(actionsSchema);

const liveConfigSchema = liveOverridableConfigSchema
  .extend({
    // Non-overrideable parameters.
    auto_unmute: z.boolean().default(liveConfigDefault.auto_unmute),
    preload: z.boolean().default(liveConfigDefault.preload),
    lazy_load: z.boolean().default(liveConfigDefault.lazy_load),
    lazy_unload: z.boolean().default(liveConfigDefault.lazy_unload),
    draggable: z.boolean().default(liveConfigDefault.draggable),
    transition_effect: transitionEffectConfigSchema.default(
      liveConfigDefault.transition_effect,
    ),
  })
  .default(liveConfigDefault);
export type LiveConfig = z.infer<typeof liveConfigSchema>;

/**
 * Menu configuration section.
 */
const menuConfigDefault = {
  mode: 'hidden-top' as const,
  buttons: {
    frigate: true,
    cameras: true,
    live: true,
    clips: true,
    snapshots: true,
    image: false,
    download: true,
    frigate_ui: true,
    fullscreen: true,
  },
  button_size: '40px',
};

const menuConfigSchema = z
  .object({
    mode: z.enum(FRIGATE_MENU_MODES).default(menuConfigDefault.mode),
    buttons: z
      .object({
        frigate: z.boolean().default(menuConfigDefault.buttons.frigate),
        cameras: z.boolean().default(menuConfigDefault.buttons.cameras),
        live: z.boolean().default(menuConfigDefault.buttons.live),
        clips: z.boolean().default(menuConfigDefault.buttons.clips),
        snapshots: z.boolean().default(menuConfigDefault.buttons.snapshots),
        image: z.boolean().default(menuConfigDefault.buttons.image),
        download: z.boolean().default(menuConfigDefault.buttons.download),
        frigate_ui: z.boolean().default(menuConfigDefault.buttons.frigate_ui),
        fullscreen: z.boolean().default(menuConfigDefault.buttons.fullscreen),
      })
      .default(menuConfigDefault.buttons),
    button_size: z.string().default(menuConfigDefault.button_size),
  })
  .default(menuConfigDefault);
export type MenuConfig = z.infer<typeof menuConfigSchema>;

/**
 * Event viewer configuration section (clip, snapshot).
 */
const viewerConfigDefault = {
  auto_play: true,
  auto_unmute: false,
  lazy_load: true,
  draggable: true,
  transition_effect: 'slide' as const,
  controls: {
    next_previous: {
      size: '48px',
      style: 'thumbnails' as const,
    },
    thumbnails: {
      size: '100px',
      mode: 'none' as const,
    },
    title: {
      mode: 'popup-bottom-right' as const,
      duration_seconds: 2,
    },
  },
};
const viewerNextPreviousControlConfigSchema = nextPreviousControlConfigSchema.extend({
  style: z
    .enum(['none', 'thumbnails', 'chevrons'])
    .default(viewerConfigDefault.controls.next_previous.style),
  size: z.string().default(viewerConfigDefault.controls.next_previous.size),
});
export type ViewerNextPreviousControlConfig = z.infer<
  typeof viewerNextPreviousControlConfigSchema
>;

const viewerConfigSchema = z
  .object({
    auto_play: z.boolean().default(viewerConfigDefault.auto_play),
    auto_unmute: z.boolean().default(viewerConfigDefault.auto_unmute),
    lazy_load: z.boolean().default(viewerConfigDefault.lazy_load),
    draggable: z.boolean().default(viewerConfigDefault.draggable),
    transition_effect: transitionEffectConfigSchema.default(
      viewerConfigDefault.transition_effect,
    ),
    controls: z
      .object({
        next_previous: viewerNextPreviousControlConfigSchema.default(
          viewerConfigDefault.controls.next_previous,
        ),
        thumbnails: thumbnailsControlSchema
          .extend({
            mode: thumbnailsControlSchema.shape.mode.default(
              viewerConfigDefault.controls.thumbnails.mode,
            ),
            size: thumbnailsControlSchema.shape.size.default(
              viewerConfigDefault.controls.thumbnails.size,
            ),
          })
          .default(viewerConfigDefault.controls.thumbnails),
        title: titleControlConfigSchema
          .extend({
            mode: titleControlConfigSchema.shape.mode.default(
              viewerConfigDefault.controls.title.mode,
            ),
            duration_seconds: titleControlConfigSchema.shape.duration_seconds.default(
              viewerConfigDefault.controls.title.duration_seconds,
            ),
          })
          .default(viewerConfigDefault.controls.title),
      })
      .default(viewerConfigDefault.controls),
  })
  .merge(actionsSchema)
  .default(viewerConfigDefault);
export type ViewerConfig = z.infer<typeof viewerConfigSchema>;

/**
 * Event gallery configuration section (clips, snapshots).
 */
const galleryConfigDefault = {
  min_columns: 5,
};

const galleryConfigSchema = z
  .object({
    min_columns: z.number().min(1).max(10).default(galleryConfigDefault.min_columns),
  })
  .merge(actionsSchema)
  .default(galleryConfigDefault);
export type GalleryConfig = z.infer<typeof galleryConfigSchema>;

/**
 * Dimensions configuration section.
 */
const dimensionsConfigDefault = {
  aspect_ratio_mode: 'dynamic' as const,
  aspect_ratio: [16, 9],
};
const dimensionsConfigSchema = z
  .object({
    aspect_ratio_mode: z
      .enum(['dynamic', 'static', 'unconstrained'])
      .default(dimensionsConfigDefault.aspect_ratio_mode),
    aspect_ratio: z
      .number()
      .array()
      .length(2)
      .or(
        z
          .string()
          .regex(/^\s*\d+\s*[:\/]\s*\d+\s*$/)
          .transform((input) => input.split(/[:\/]/).map((d) => Number(d))),
      )
      .default(dimensionsConfigDefault.aspect_ratio),
  })
  .default(dimensionsConfigDefault);

/**
 * Configuration overrides
 */
// Strip all defaults from the override schemas, to ensure values are only what
// the user has specified.
const overrideConfigurationSchema = z.object({
  live: deepRemoveDefaults(liveOverridableConfigSchema).optional(),
  menu: deepRemoveDefaults(menuConfigSchema).optional(),
  image: deepRemoveDefaults(imageConfigSchema).optional(),
});
export type OverrideConfigurationKey = keyof z.infer<typeof overrideConfigurationSchema>;

const overridesSchema = z
  .object({
    conditions: frigateCardConditionSchema,
    overrides: overrideConfigurationSchema,
  })
  .array()
  .optional();

const liveOverridesSchema = z
  .object({
    conditions: frigateCardConditionSchema,
    overrides: liveOverridableConfigSchema,
  })
  .array()
  .optional();
export type LiveOverrides = z.infer<typeof liveOverridesSchema>;

/**
 * Main card config.
 */
export const frigateCardConfigSchema = z.object({
  // Main configuration sections.
  cameras: cameraConfigSchema.array().nonempty(),
  view: viewConfigSchema,
  menu: menuConfigSchema,
  live: liveConfigSchema,
  event_viewer: viewerConfigSchema,
  event_gallery: galleryConfigSchema,
  image: imageConfigSchema,
  elements: pictureElementsSchema,
  dimensions: dimensionsConfigSchema,

  // Configuration overrides.
  overrides: overridesSchema,

  // Support for card_mod (https://github.com/thomasloven/lovelace-card-mod).
  card_mod: z.unknown(),

  // Stock lovelace card config.
  type: z.string(),
  test_gui: z.boolean().optional(),
});
export type FrigateCardConfig = z.infer<typeof frigateCardConfigSchema>;
export type RawFrigateCardConfig = Record<string, unknown>;
export type RawFrigateCardConfigArray = RawFrigateCardConfig[];

export const frigateCardConfigDefaults = {
  cameras: cameraConfigDefault,
  view: viewConfigDefault,
  menu: menuConfigDefault,
  live: liveConfigDefault,
  event_viewer: viewerConfigDefault,
  event_gallery: galleryConfigDefault,
  image: imageConfigDefault,
};

const menuButtonSchema = z.discriminatedUnion('type', [
  menuIconSchema,
  menuStateIconSchema,
  menuSubmenuSchema,
]);
export type MenuButton = z.infer<typeof menuButtonSchema>;
export interface ExtendedHomeAssistant {
  hassUrl(path?): string;
}

export interface BrowseMediaQueryParameters {
  mediaType: 'clips' | 'snapshots';
  clientId: string;
  cameraName: string;
  label?: string;
  zone?: string;
  before?: number;
  after?: number;
}

export interface BrowseMediaNeighbors {
  previous: FrigateBrowseMediaSource | null;
  previousIndex: number | null;

  next: FrigateBrowseMediaSource | null;
  nextIndex: number | null;
}

export interface MediaShowInfo {
  width: number;
  height: number;
}

export interface Message {
  message: string;
  type: 'error' | 'info';
  icon?: string;
  context?: unknown;
}

export interface StateParameters {
  entity?: string;
  icon?: string;
  title?: string | null;
  state_color?: boolean;
  style?: StyleInfo;
  data_domain?: string;
  data_state?: string;
}

export interface FrigateCardMediaPlayer {
  play(): void;
  pause(): void;
  mute(): void;
  unmute(): void;
}

/**
 * Home Assistant API types.
 */

// Recursive type, cannot use type interference:
// See: https://github.com/colinhacks/zod#recursive-types
//
// Server side data-type defined here: https://github.com/home-assistant/core/blob/dev/homeassistant/components/media_player/browse_media.py#L46
interface BrowseMediaSource {
  title: string;
  media_class: string;
  media_content_type: string;
  media_content_id: string;
  can_play: boolean;
  can_expand: boolean;
  children_media_class?: string | null;
  thumbnail: string | null;
  children?: BrowseMediaSource[] | null;
}

export interface FrigateBrowseMediaSource extends BrowseMediaSource {
  children?: FrigateBrowseMediaSource[] | null;
  frigate?: {
    event: {
      camera: string;
      end_time: number;
      false_positive: boolean;
      has_clip: boolean;
      has_snapshot: boolean;
      id: string;
      label: string;
      start_time: number;
      top_score: number;
      zones: string[];
    };
  };
}

export const frigateBrowseMediaSourceSchema: z.ZodSchema<BrowseMediaSource> = z.lazy(
  () =>
    z.object({
      title: z.string(),
      media_class: z.string(),
      media_content_type: z.string(),
      media_content_id: z.string(),
      can_play: z.boolean(),
      can_expand: z.boolean(),
      children_media_class: z.string().nullable().optional(),
      thumbnail: z.string().nullable(),
      children: z.array(frigateBrowseMediaSourceSchema).nullable().optional(),
      frigate: z.object({
        event: z.object({
          camera: z.string(),
          end_time: z.number().nullable(),
          false_positive: z.boolean(),
          has_clip: z.boolean(),
          has_snapshot: z.boolean(),
          id: z.string(),
          label: z.string(),
          start_time: z.number(),
          top_score: z.number(),
          zones: z.string().array(),
        }),
      }).optional(),
    }),
);

// Server side data-type defined here: https://github.com/home-assistant/core/blob/dev/homeassistant/components/media_source/models.py
export const resolvedMediaSchema = z.object({
  url: z.string(),
  mime_type: z.string(),
});
export type ResolvedMedia = z.infer<typeof resolvedMediaSchema>;

export const signedPathSchema = z.object({
  path: z.string(),
});
export type SignedPath = z.infer<typeof signedPathSchema>;

export const entitySchema = z.object({
  entity_id: z.string(),
  unique_id: z.string(),
  platform: z.string(),
});
export type Entity = z.infer<typeof entitySchema>;
