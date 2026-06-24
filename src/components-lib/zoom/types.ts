import type { PartialDeep } from 'type-fest';

export const ZOOM_DEFAULT_PAN_X = 50;
export const ZOOM_DEFAULT_PAN_Y = 50;
export const ZOOM_DEFAULT_SCALE = 1;
export const ZOOM_PRECISION = 4;

export interface ZoomSettingsBase {
  pan: {
    x: number;
    y: number;
  };
  zoom: number;
}

export type PartialZoomSettings = PartialDeep<ZoomSettingsBase>;

export interface ZoomSettingsObserved extends ZoomSettingsBase {
  isDefault: boolean;
  unzoomed: boolean;
}

export const isZoomEmpty = (settings?: PartialZoomSettings | null): boolean => {
  return (
    settings?.pan?.x === undefined &&
    settings?.pan?.y === undefined &&
    settings?.zoom === undefined
  );
};
