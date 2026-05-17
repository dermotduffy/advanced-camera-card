import { View } from '../../../view/view';
import { ViewModifier } from '../types';

// The single write path for the camera-keyed `live.overrides` map (the read
// path being `getStreamCameraID` in `view/substream`): sets a camera's
// substream override, or clears it when `substreamID` is absent so the
// camera's own stream is used. `cameraID` defaults to the selected camera.
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
