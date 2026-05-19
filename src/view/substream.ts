import { View } from './view';

// Resolves the engaged stream for a camera: its substream override if one is
// set in `live.overrides`, otherwise the camera itself. `cameraID` defaults to
// the selected camera. The write path is `SubstreamViewModifier`.
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
