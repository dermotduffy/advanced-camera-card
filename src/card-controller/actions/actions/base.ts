import { ActionContext } from 'action';
import {
  ActionConfig,
  AuxillaryActionConfig,
} from '../../../config/schema/actions/types.js';
import { localize } from '../../../localize/localize.js';
import { isAdvancedCameraCardCustomAction } from '../../../utils/action';
import { CardActionsAPI } from '../../types';
import { Action, ActionAbortError } from '../types';

export class BaseAction<T extends ActionConfig> implements Action {
  protected _context: ActionContext;
  protected _action: T;
  protected _config?: AuxillaryActionConfig;

  constructor(context: ActionContext, action: T, config?: AuxillaryActionConfig) {
    this._context = context;
    this._action = action;
    this._config = config;
  }

  protected _shouldSeekConfirmation(api: CardActionsAPI): boolean {
    const hass = api.getHASSManager().getHASS();
    const action: ActionConfig = this._action;

    return (
      (typeof action.confirmation === 'boolean' && action.confirmation) ||
      (typeof action.confirmation === 'object' &&
        (!action.confirmation.exemptions ||
          !action.confirmation.exemptions.some((entry) => entry.user === hass?.user.id)))
    );
  }

  public async execute(api: CardActionsAPI): Promise<void> {
    if (this._shouldSeekConfirmation(api)) {
      const action: ActionConfig = this._action;
      const baseAction = action.action;
      const actionName = isAdvancedCameraCardCustomAction(action)
        ? action.advanced_camera_card_action
        : baseAction;
      const text =
        (typeof action.confirmation === 'object' ? action.confirmation.text : null) ??
        `${localize('actions.confirmation')}: ${actionName}`;
      if (!confirm(text)) {
        throw new ActionAbortError(localize('actions.abort'));
      }
    }
  }

  public async stop(): Promise<void> {
    // Pass.
  }
}

export class AdvancedCameraCardAction<T extends ActionConfig> extends BaseAction<T> {}
