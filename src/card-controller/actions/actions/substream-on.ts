import { CameraManager } from '../../../camera-manager/manager';
import { SubstreamViewModifier } from '../../view/modifiers/substream';
import { GeneralActionConfig } from '../../../config/schema/actions/custom/general';
import { View } from '../../../view/view';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class SubstreamOnAction extends AdvancedCameraCardAction<GeneralActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    const view = api.getViewManager().getView();
    if (!view) {
      return;
    }

    api.getViewManager().setViewByParameters({
      modifiers: [
        new SubstreamViewModifier(
          this._getCycledSubstreamID(view, api.getCameraManager()),
        ),
      ],
    });
  }

  // The next substream in the selected camera's cycle: its `substream`
  // dependencies in order, wrapping back round. `undefined` means the camera's
  // own stream (no substream).
  private _getCycledSubstreamID(
    view: View,
    cameraManager: CameraManager,
  ): string | undefined {
    if (!view.camera) {
      return undefined;
    }
    const dependencies = [
      ...cameraManager.getStore().getAllDependentCameras(view.camera, 'substream'),
    ];
    if (dependencies.length <= 1) {
      return undefined;
    }
    const current = view.context?.live?.overrides?.get(view.camera) ?? view.camera;
    const currentIndex = dependencies.indexOf(current);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % dependencies.length;
    // Index 0 is the camera itself, i.e. no substream.
    return dependencies[nextIndex] === view.camera ? undefined : dependencies[nextIndex];
  }
}
