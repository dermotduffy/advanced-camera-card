import type { MediaLayoutConfig } from '../config/schema/camera/media-layout';
import type { CameraDimensionsConfig } from '../config/schema/cameras';
import { isValidAspectRatio, setOrRemoveStyleProperty } from './basic';

const POSITION_DIMENSIONS: (keyof NonNullable<MediaLayoutConfig['position']>)[] = [
  'x',
  'y',
];
const VIEW_BOX_EDGES: (keyof NonNullable<MediaLayoutConfig['view_box']>)[] = [
  'top',
  'bottom',
  'left',
  'right',
];

/**
 * Update element style from a media configuration.
 * @param element The element to update the style for.
 * @param mediaLayoutConfig The media config object.
 */
export const updateElementStyleFromMediaLayoutConfig = (
  element: HTMLElement,
  mediaLayoutConfig?: MediaLayoutConfig,
): void => {
  setOrRemoveStyleProperty(
    element,
    !!mediaLayoutConfig?.fit,
    '--advanced-camera-card-media-layout-fit',
    mediaLayoutConfig?.fit,
  );

  for (const dimension of POSITION_DIMENSIONS) {
    setOrRemoveStyleProperty(
      element,
      mediaLayoutConfig?.position?.[dimension] !== undefined,
      `--advanced-camera-card-media-layout-position-${dimension}`,
      `${mediaLayoutConfig?.position?.[dimension]}%`,
    );
  }

  for (const dimension of VIEW_BOX_EDGES) {
    setOrRemoveStyleProperty(
      element,
      !!mediaLayoutConfig?.view_box?.[dimension],
      `--advanced-camera-card-media-layout-view-box-${dimension}`,
      `${mediaLayoutConfig?.view_box?.[dimension]}%`,
    );
  }
};

/**
 * Whether media is drawn at its own aspect ratio, contained and centered within
 * its container.
 * @param dimensions The camera dimensions the media is laid out with.
 */
export const isMediaContainedAndCentered = (
  dimensions: CameraDimensionsConfig | null,
): boolean => {
  const layout = dimensions?.layout;
  return (
    !isValidAspectRatio(dimensions?.aspect_ratio) &&
    !dimensions?.rotation &&
    (layout?.fit ?? 'contain') === 'contain' &&
    POSITION_DIMENSIONS.every(
      (dimension) => (layout?.position?.[dimension] ?? 50) === 50,
    ) &&
    !VIEW_BOX_EDGES.some((edge) => !!layout?.view_box?.[edge])
  );
};
