import type { CameraManager } from '../../../camera-manager/manager';
import type { SubstreamOnActionConfig } from '../../../config/schema/actions/custom/substream-on';
import type { View } from '../../../view/view';
import type { CardActionsAPI } from '../../types';
import { SubstreamViewModifier } from '../../view/modifiers/substream';
import { AdvancedCameraCardAction } from './base';

export class SubstreamOnAction extends AdvancedCameraCardAction<SubstreamOnActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    const view = api.getViewManager().getView();
    if (!view) {
      return;
    }

    const action = this._getAction();
    const cameraID = action.camera ?? view.camera;
    if (!cameraID) {
      return;
    }

    const stream =
      action.stream ??
      this._getCycledSubstreamID(view, cameraID, api.getCameraManager());

    api.getViewManager().setViewByParameters({
      modifiers: [new SubstreamViewModifier({ stream, camera: cameraID })],
    });
  }

  // The next substream in the camera's cycle: its `substream` dependencies in
  // order, wrapping back round. `undefined` means the camera's own stream (no
  // substream).
  private _getCycledSubstreamID(
    view: View,
    cameraID: string,
    cameraManager: CameraManager,
  ): string | undefined {
    const dependencies = [
      ...cameraManager.getStore().getAllDependentCameras(cameraID, 'substream'),
    ];
    if (dependencies.length <= 1) {
      return undefined;
    }
    const current = view.context?.live?.overrides?.get(cameraID) ?? cameraID;
    const currentIndex = dependencies.indexOf(current);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % dependencies.length;
    // Index 0 is the camera itself, i.e. no substream.
    return dependencies[nextIndex] === cameraID ? undefined : dependencies[nextIndex];
  }
}
