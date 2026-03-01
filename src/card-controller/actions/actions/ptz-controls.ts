import { PTZControlsActionConfig } from '../../../config/schema/actions/custom/ptz-controls';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class PTZControlsAction extends AdvancedCameraCardAction<PTZControlsActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    const currentEnabled = api.getViewManager().getView()?.context?.ptzControls?.enabled;

    // If `enabled` is explicit, use it. If only `type` is being changed, leave
    // `enabled` untouched (undefined = no change). Otherwise (neither set),
    // toggle the current enabled value — this is the menu-button show/hide use
    // case.
    const enabled =
      this._action.enabled ??
      (this._action.type
        ? undefined
        : currentEnabled === undefined
          ? undefined
          : !currentEnabled);

    api.getViewManager().setViewWithMergedContext({
      ptzControls: {
        ...(enabled !== undefined && { enabled }),
        ...(this._action.type && { type: this._action.type }),
      },
    });
  }
}
