import type { ActionContext } from 'action';

import type { ActionConfig } from '../../../config/schema/actions/types';
import { arrayify } from '../../../utils/basic';
import type { CardActionsAPI } from '../../types';
import { ActionFactory, type ActionFactoryOptions } from '../factory';
import type { ActionPrepareCallback } from '../types';

interface ActionSetOptions {
  factoryOptions?: ActionFactoryOptions;
  renderTemplates?: boolean;
}

// A self-contained sequence of actions, executed in order.
export class ActionSet {
  private _context: ActionContext;
  private _actions: ActionConfig[];
  private _factoryOptions?: ActionFactoryOptions;
  private _renderTemplates: boolean;
  private _factory = new ActionFactory();
  private _stopped = false;

  constructor(
    context: ActionContext,
    actions: ActionConfig | ActionConfig[],
    options?: ActionSetOptions,
  ) {
    this._context = context;
    this._actions = arrayify(actions);
    this._factoryOptions = options?.factoryOptions;
    this._renderTemplates = options?.renderTemplates ?? true;
  }

  // Returns whether any action actually ran.
  public async execute(api: CardActionsAPI): Promise<boolean> {
    // Lock filtering and the factory both classify on the raw (unrendered)
    // discriminator (`action` / `advanced_camera_card_action`) -- as in Home
    // Assistant, i.e. you cannot template the action itself.
    const allowedActions = api.getLockManager().getAllowedActions(this._actions);
    const prepareCallback = this._renderTemplates
      ? this._createPrepareCallback(api)
      : undefined;

    let executed = false;
    for (const action of allowedActions) {
      if (this._stopped) {
        break;
      }

      const concreteAction = this._factory.createAction(
        this._context,
        action,
        this._factoryOptions,
      );
      if (concreteAction) {
        // Prepare against the state as it is now, so an action observes what an
        // earlier action in the sequence changed. A prepare error aborts the
        // rest of the sequence (it propagates to the caller's handler).
        if (prepareCallback) {
          concreteAction.prepare(prepareCallback);
        }
        await concreteAction.execute(api);
        executed = true;
      }
    }

    return executed;
  }

  public async stop(): Promise<void> {
    this._stopped = true;
  }

  private _createPrepareCallback(api: CardActionsAPI): ActionPrepareCallback {
    const triggerData = this._factoryOptions?.triggerData;
    return <T>(value: T): T => {
      const hass = api.getHASSManager().getHASS();
      return hass
        ? api.getTemplateManager().renderRecursivelyAsType(hass, value, {
            conditionState: api.getConditionStateManager().getState(),
            triggerData,
          })
        : value;
    };
  }
}
