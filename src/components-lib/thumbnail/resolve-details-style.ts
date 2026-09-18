import type {
  ThumbnailDetailsStyle,
  ThumbnailsControlBaseConfig,
} from '../../config/schema/common/controls/thumbnails';
import { isHoverableDevice } from '../../utils/basic';

export type ResolvedThumbnailDetailsStyle = Exclude<ThumbnailDetailsStyle, 'auto'>;

type ThumbnailPlacement = 'grid' | 'surround-vertical' | 'surround-horizontal' | 'popup';

export interface ThumbnailDetailsStyleContext {
  placement: ThumbnailPlacement;

  // The width the thumbnails and their details have to fit into.
  availableWidth?: number;
}

// Matches `--advanced-camera-card-thumbnail-details-panel-width-min`, which caps
// the image so the panel keeps this much beside it.
export const DETAILS_PANEL_WIDTH = 150;

// A gallery thumbnail smaller than this uses overlay instead.
const HOVER_SIZE_MIN = 200;

const resolveAutoThumbnailDetailsStyle = (
  config: ThumbnailsControlBaseConfig,
  context: ThumbnailDetailsStyleContext,
): ResolvedThumbnailDetailsStyle => {
  if (
    context.availableWidth !== undefined &&
    context.availableWidth < config.size + DETAILS_PANEL_WIDTH
  ) {
    return 'overlay';
  }

  if (context.placement === 'popup') {
    return 'panel';
  }

  // A panel costs width. Vertical drawers have "width for free".
  if (context.placement === 'surround-vertical') {
    return 'panel';
  }

  // A details panel on a horizontal drawer will consume space that could be
  // filled with other thumbnails.
  if (context.placement === 'surround-horizontal') {
    return 'hover';
  }

  // A small thumbnail cannot be identified from its picture alone, so it keeps
  // the details on screen.
  return config.size >= HOVER_SIZE_MIN ? 'hover' : 'overlay';
};

export const resolveThumbnailDetailsStyle = (
  config: ThumbnailsControlBaseConfig,
  context: ThumbnailDetailsStyleContext,
): ResolvedThumbnailDetailsStyle => {
  const style =
    config.details_style === 'auto'
      ? resolveAutoThumbnailDetailsStyle(config, context)
      : config.details_style;

  return style === 'hover' && !isHoverableDevice() ? 'overlay' : style;
};
