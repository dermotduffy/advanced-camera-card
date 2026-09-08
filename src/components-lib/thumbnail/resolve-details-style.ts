import type {
  ThumbnailDetailsStyle,
  ThumbnailsControlBaseConfig,
} from '../../config/schema/common/controls/thumbnails';

export type ResolvedThumbnailDetailsStyle = Exclude<ThumbnailDetailsStyle, 'auto'>;

type ThumbnailPlacement = 'grid' | 'surround-vertical' | 'surround-horizontal' | 'popup';

export interface ThumbnailDetailsStyleContext {
  placement: ThumbnailPlacement;

  // The width the thumbnails and their details have to fit into.
  availableWidth?: number;
}

// Room a details panel needs beside the thumbnail.
const DETAILS_PANEL_WIDTH_ALLOWANCE = 200;

// The smallest grid thumbnail that reveals its details on hover.
const HOVER_SIZE_MIN = 200;

export const resolveThumbnailDetailsStyle = (
  config: ThumbnailsControlBaseConfig,
  context: ThumbnailDetailsStyleContext,
): ResolvedThumbnailDetailsStyle => {
  if (config.details_style !== 'auto') {
    return config.details_style;
  }

  if (
    context.availableWidth !== undefined &&
    context.availableWidth < config.size + DETAILS_PANEL_WIDTH_ALLOWANCE
  ) {
    return 'overlay';
  }

  // The popup itself only appears under the pointer.
  if (context.placement === 'popup') {
    return 'hover';
  }

  if (context.placement === 'surround-vertical') {
    return 'panel';
  }

  // Without the info control there is no popup to reach the truncated
  // details in, so show all of them in place.
  if (!config.show_info_control) {
    return 'hover';
  }

  if (context.placement === 'surround-horizontal') {
    return 'hover';
  }

  // A larger thumbnail is worth seeing unobstructed, so don't show details
  // until there's a hover. A smaller thumbnail is hard to identify without the
  // details, so overlay them.
  return config.size >= HOVER_SIZE_MIN ? 'hover' : 'overlay';
};
