import { View } from '../view/view';

/**
 * Get the effective camera ID for streaming, considering substream overrides.
 * Returns null if the view has no camera.
 */
export const getStreamCameraID = (
  view: View,
  cameraID?: string | null,
): string | null => {
  const baseCameraID = cameraID ?? view.camera;
  if (!baseCameraID) {
    return null;
  }
  return view.context?.live?.overrides?.get(baseCameraID) ?? baseCameraID;
};

export const hasSubstream = (view: View): boolean => {
  if (!view.camera) {
    return false;
  }
  return getStreamCameraID(view) !== view.camera;
};

export const setSubstream = (view: View, substreamID: string): void => {
  if (!view.camera) {
    return;
  }
  const overrides: Map<string, string> = view.context?.live?.overrides ?? new Map();
  overrides.set(view.camera, substreamID);
  view.mergeInContext({
    live: { overrides: overrides },
  });
};

export const removeSubstream = (view: View): void => {
  if (!view.camera) {
    return;
  }
  const overrides: Map<string, string> | undefined = view.context?.live?.overrides;
  if (overrides && overrides.has(view.camera)) {
    view.context?.live?.overrides?.delete(view.camera);
  }
};
