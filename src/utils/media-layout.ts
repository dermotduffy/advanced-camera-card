import { MediaLayoutConfig } from '../config/schema/camera/media-layout';

/**
 * Update element style from a media configuration.
 * @param element The element to update the style for.
 * @param mediaLayoutConfig The media config object.
 */
export const updateElementStyleFromMediaLayoutConfig = (
  element: HTMLElement,
  mediaLayoutConfig?: MediaLayoutConfig,
): void => {
  if (mediaLayoutConfig?.fit !== undefined) {
    element.style.setProperty(
      '--advanced-camera-card-media-layout-fit',
      mediaLayoutConfig.fit,
    );
  } else {
    element.style.removeProperty('--advanced-camera-card-media-layout-fit');
  }
  for (const dimension of ['x', 'y']) {
    if (mediaLayoutConfig?.position?.[dimension] !== undefined) {
      element.style.setProperty(
        `--advanced-camera-card-media-layout-position-${dimension}`,
        `${mediaLayoutConfig.position[dimension]}%`,
      );
    } else {
      element.style.removeProperty(
        `--advanced-camera-card-media-layout-position-${dimension}`,
      );
    }
  }
  for (const dimension of ['top', 'bottom', 'left', 'right']) {
    if (mediaLayoutConfig?.view_box?.[dimension] !== undefined) {
      element.style.setProperty(
        `--advanced-camera-card-media-layout-view-box-${dimension}`,
        `${mediaLayoutConfig.view_box[dimension]}%`,
      );
    } else {
      element.style.removeProperty(
        `--advanced-camera-card-media-layout-view-box-${dimension}`,
      );
    }
  }
};
