import type { ThumbnailsControlBaseConfig } from '../../config/schema/common/controls/thumbnails';
import { aspectRatioToString, isValidAspectRatio, type Size } from '../../utils/basic';

type ThumbnailDimensionsConfig = Pick<ThumbnailsControlBaseConfig, 'size'> &
  Partial<Pick<ThumbnailsControlBaseConfig, 'aspect_ratio'>>;

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
export const getThumbnailDimensions = (config: ThumbnailDimensionsConfig): Size => {
  const [ratioWidth, ratioHeight] = isValidAspectRatio(config.aspect_ratio)
    ? config.aspect_ratio
    : [1, 1];
  const scale = config.size / Math.max(ratioWidth, ratioHeight);

  return {
    width: ratioWidth * scale,
    height: ratioHeight * scale,
  };
};

export const getThumbnailShorterSide = (config: ThumbnailDimensionsConfig): number => {
  const { width, height } = getThumbnailDimensions(config);
  return Math.min(width, height);
};

/**
 * Set, on `element`, the CSS variables that the thumbnails inside it are sized
 * from:
 *
 * - `--advanced-camera-card-thumbnail-size`: the `size` configuration option,
 *   which is the length of the image's longer side. A `panel` thumbnail in a
 *   carousel or timeline popup is this tall, leaving room for its details
 *   beside an image that is shorter than this.
 * - `--advanced-camera-card-thumbnail-width` and
 *   `--advanced-camera-card-thumbnail-height`: the dimensions of the image
 *   itself, e.g. 100 x 56.25 for `aspect_ratio: 16:9` at `size: 100`.
 * - `--advanced-camera-card-thumbnail-aspect-ratio`: the image's aspect ratio,
 *   for the CSS `aspect-ratio` property.
 *
 * Without a config, all four are removed.
 */
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
    aspectRatioToString({ ratio: [width, height] }),
  );
};
