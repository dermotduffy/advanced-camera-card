import { CameraManager } from '../../camera-manager/manager';
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

// =============================================================================
// Substream ViewModifier classes: composed into the modifiers list of a
// ViewManager.setViewByParameters / setViewDefaultWithNewQuery call. Co-located
// with the substream types so all substream knowledge lives in one place
// (unlike generic modifiers, which live in `card-controller/view/ modifiers/`
// and are not tied to any particular view kind).
// =============================================================================

export class SubstreamSelectViewModifier implements ViewModifier {
  private _substreamID: string;

  constructor(substreamID: string) {
    this._substreamID = substreamID;
  }

  public modify(view: View): void {
    writeOverride(view, this._substreamID);
  }
}

export class SubstreamOffViewModifier implements ViewModifier {
  public modify(view: View): void {
    if (!view.camera) {
      return;
    }
    view.context?.live?.overrides?.delete(view.camera);
  }
}

export class SubstreamOnViewModifier implements ViewModifier {
  private _cameraManager: CameraManager;

  constructor(cameraManager: CameraManager) {
    this._cameraManager = cameraManager;
  }

  public modify(view: View): void {
    if (!view.camera) {
      return;
    }
    const dependencies = [
      ...this._cameraManager
        .getStore()
        .getAllDependentCameras(view.camera, 'substream'),
    ];
    if (dependencies.length <= 1) {
      return;
    }
    const currentOverride = getStreamCameraID(view);
    /* istanbul ignore if: the if path cannot be reached, as the view.camera
    guard above ensures getStreamCameraID returns non-null -- @preserve */
    if (!currentOverride) {
      return;
    }
    const currentIndex = dependencies.indexOf(currentOverride);
    const newIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % dependencies.length;
    writeOverride(view, dependencies[newIndex]);
  }
}

const writeOverride = (view: View, substreamID: string): void => {
  if (!view.camera) {
    return;
  }
  const overrides = view.context?.live?.overrides ?? new Map<string, string>();
  overrides.set(view.camera, substreamID);
  view.mergeInContext({ live: { overrides } });
};
