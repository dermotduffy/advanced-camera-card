import { ViewModifier } from '../../card-controller/view/types';
import { View } from '../../view/view';

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

// The single write path for the camera-keyed `live.overrides` map (the read
// path being `getStreamCameraID`): sets a camera's substream override, or
// clears it when `substreamID` is absent so the camera's own stream is used.
// `cameraID` defaults to the selected camera.
export class SubstreamViewModifier implements ViewModifier {
  private _substreamID?: string;
  private _cameraID?: string;

  constructor(substreamID?: string, cameraID?: string) {
    this._substreamID = substreamID;
    this._cameraID = cameraID;
  }

  public modify(view: View): void {
    const cameraID = this._cameraID ?? view.camera;
    if (!cameraID) {
      return;
    }
    if (!this._substreamID) {
      view.context?.live?.overrides?.delete(cameraID);
      return;
    }
    const overrides = view.context?.live?.overrides ?? new Map<string, string>();
    overrides.set(cameraID, this._substreamID);
    view.mergeInContext({ live: { overrides } });
  }
}
