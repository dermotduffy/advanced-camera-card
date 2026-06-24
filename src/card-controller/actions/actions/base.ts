import type { ActionContext } from 'action';

import type {
  ActionConfig,
  AuxillaryActionConfig,
} from '../../../config/schema/actions/types.js';
import { localize } from '../../../localize/localize.js';
import { getActionName } from '../../../utils/action';
import type { CardActionsAPI } from '../../types';
import { ActionAbortError, type Action, type ActionPrepareCallback } from '../types';

export class BaseAction<T extends ActionConfig> implements Action {
  protected _context: ActionContext;
  protected _rawAction: T;
  protected _preparedAction: T | null = null;
  protected _config?: AuxillaryActionConfig;

  constructor(context: ActionContext, action: T, config?: AuxillaryActionConfig) {
    this._context = context;
    this._rawAction = action;
    this._config = config;
  }

  public prepare(actionPrepareCallback: ActionPrepareCallback): void {
    this._preparedAction = actionPrepareCallback(this._rawAction);
  }

  // The config to act on: the prepared (rendered) form once prepare() has run,
  // otherwise the raw config (e.g. under direct execution without a prepare).
  protected _getAction(): T {
    return this._preparedAction ?? this._rawAction;
  }

  protected _shouldSeekConfirmation(api: CardActionsAPI): boolean {
    const hass = api.getHASSManager().getHASS();
    const action: ActionConfig = this._getAction();

    return (
      (typeof action.confirmation === 'boolean' && action.confirmation) ||
      (typeof action.confirmation === 'object' &&
        (!action.confirmation.exemptions ||
          !action.confirmation.exemptions.some((entry) => entry.user === hass?.user.id)))
    );
  }

  public async execute(api: CardActionsAPI): Promise<void> {
    if (this._shouldSeekConfirmation(api)) {
      const action: ActionConfig = this._getAction();
      const text =
        (typeof action.confirmation === 'object' ? action.confirmation.text : null) ??
        `${localize('actions.confirmation')}: ${getActionName(action)}`;
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
