import type { ThumbnailsControlBaseConfig } from '../../config/schema/common/controls/thumbnails';
import { isValidAspectRatio } from '../../utils/basic';

type ThumbnailDimensionsConfig = Pick<
  ThumbnailsControlBaseConfig,
  'aspect_ratio' | 'size'
>;

interface ThumbnailDimensions {
  width: number;
  height: number;
}

const THUMBNAIL_STYLE_PROPERTIES = [
  '--advanced-camera-card-thumbnail-size',
  '--advanced-camera-card-thumbnail-width',
  '--advanced-camera-card-thumbnail-height',
  '--advanced-camera-card-thumbnail-aspect-ratio',
] as const;

/**
 * The longer side is drawn at `size`, so thumbnails of any aspect ratio fit the
 * same square.
 */
export const getThumbnailDimensions = (
  config: ThumbnailDimensionsConfig,
): ThumbnailDimensions => {
  const [ratioWidth, ratioHeight] = isValidAspectRatio(config.aspect_ratio)
    ? config.aspect_ratio
    : [1, 1];
  const scale = config.size / Math.max(ratioWidth, ratioHeight);

  return {
    width: ratioWidth * scale,
    height: ratioHeight * scale,
  };
};

/**
 * The details tiers were drawn for a square thumbnail, so a wide or tall one
 * takes the tier of its shorter side.
 */
export const getThumbnailTierSize = (config: ThumbnailDimensionsConfig): number => {
  const { width, height } = getThumbnailDimensions(config);
  return Math.min(width, height);
};

export const setThumbnailDimensionsStyle = (
  element: HTMLElement,
  config: ThumbnailDimensionsConfig | null,
): void => {
  if (!config) {
    THUMBNAIL_STYLE_PROPERTIES.forEach((property) =>
      element.style.removeProperty(property),
    );
    return;
  }

  const { width, height } = getThumbnailDimensions(config);
  element.style.setProperty('--advanced-camera-card-thumbnail-size', `${config.size}px`);
  element.style.setProperty('--advanced-camera-card-thumbnail-width', `${width}px`);
  element.style.setProperty('--advanced-camera-card-thumbnail-height', `${height}px`);
  element.style.setProperty(
    '--advanced-camera-card-thumbnail-aspect-ratio',
    `${width} / ${height}`,
  );
};
