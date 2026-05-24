import { View } from '../../../view/view';
import { ViewModifier } from '../types';

interface SubstreamViewModifierOptions {
  // The substream to engage. When absent, the override is cleared so the
  // camera's own stream is used.
  stream?: string;

  // The camera whose override to write. Defaults to the selected camera.
  camera?: string;
}

// The single write path for the camera-keyed `live.overrides` map (the read
// path being `getStreamCameraID` in `view/substream`).
export class SubstreamViewModifier implements ViewModifier {
  private _options: SubstreamViewModifierOptions;

  constructor(options?: SubstreamViewModifierOptions) {
    this._options = options ?? {};
  }

  public modify(view: View): void {
    const cameraID = this._options.camera ?? view.camera;
    if (!cameraID) {
      return;
    }
    // A stream equal to the camera itself is semantically "no substream";
    // normalise it to a cleared override so the map doesn't carry self-
    // referential entries.
    if (!this._options.stream || this._options.stream === cameraID) {
      view.context?.live?.overrides?.delete(cameraID);
      return;
    }
    const overrides = view.context?.live?.overrides ?? new Map<string, string>();
    overrides.set(cameraID, this._options.stream);
    view.mergeInContext({ live: { overrides } });
  }
}
