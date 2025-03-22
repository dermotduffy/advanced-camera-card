import { z } from 'zod';
import { deepRemoveDefaults } from '../../utils/zod';
import { automationsSchema } from './automations';
import { cameraConfigDefault, cameraConfigSchema, camerasConfigSchema } from './cameras';
import { cardIDRegex } from './common/const';
import { timelineConfigDefault } from './common/controls/timeline';
import { imageConfigDefault } from './common/image';
import { DebugConfig, debugConfigDefault, debugConfigSchema } from './debug';
import { dimensionsConfigSchema } from './dimensions';
import { pictureElementsSchema } from './elements/types';
import { galleryConfigDefault, galleryConfigSchema } from './gallery';
import { imageConfigSchema } from './image';
import { liveConfigDefault, liveConfigSchema } from './live';
import { menuConfigDefault, menuConfigSchema } from './menu';
import { overridesSchema } from './overrides';
import {
  PerformanceConfig,
  performanceConfigDefault,
  performanceConfigSchema,
} from './performance';
import { profilesSchema } from './profiles';
import { remoteControlConfigSchema } from './remote-control';
import { statusBarConfigDefault, statusBarConfigSchema } from './status-bar';
import { timelineConfigSchema } from './timeline';
import { viewConfigDefault, viewConfigSchema } from './view';
import { viewerConfigDefault, viewerConfigSchema } from './viewer';

export interface CardWideConfig {
  performance?: PerformanceConfig;
  debug?: DebugConfig;
}

export const advancedCameraCardConfigSchema = z.object({
  // Defaults are stripped out of the individual cameras, since each camera will
  // be merged with `cameras_global` which *does* have defaults. If we didn't do
  // this, the default values of each individual camera would override the
  // intentionally specified values in `cameras_global` during camera
  // initialization when the two configs are merged.
  cameras: deepRemoveDefaults(camerasConfigSchema),
  cameras_global: cameraConfigSchema,

  view: viewConfigSchema,
  menu: menuConfigSchema,
  status_bar: statusBarConfigSchema,
  live: liveConfigSchema,
  media_gallery: galleryConfigSchema,
  media_viewer: viewerConfigSchema,
  image: imageConfigSchema,
  elements: pictureElementsSchema,
  dimensions: dimensionsConfigSchema,
  timeline: timelineConfigSchema,
  performance: performanceConfigSchema,
  debug: debugConfigSchema,
  automations: automationsSchema.optional(),

  profiles: profilesSchema,

  // Configuration overrides.
  overrides: overridesSchema,

  // Support for card_mod (https://github.com/thomasloven/lovelace-card-mod).
  card_mod: z.unknown(),

  // Card ID (used for query string commands). Restrict contents to only values
  // that be easily used in a URL.
  card_id: z.string().regex(cardIDRegex).optional(),

  remote_control: remoteControlConfigSchema,

  // Stock lovelace card config.
  type: z.string(),
});
export type AdvancedCameraCardConfig = z.infer<typeof advancedCameraCardConfigSchema>;

export const configDefaults = {
  cameras: cameraConfigDefault,
  view: viewConfigDefault,
  menu: menuConfigDefault,
  status_bar: statusBarConfigDefault,
  live: liveConfigDefault,
  media_gallery: galleryConfigDefault,
  media_viewer: viewerConfigDefault,
  image: imageConfigDefault,
  timeline: timelineConfigDefault,
  performance: performanceConfigDefault,
  debug: debugConfigDefault,
};
