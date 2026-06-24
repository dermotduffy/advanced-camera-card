import type { ActionContext } from 'action';

import type { ActionConfig } from '../../../config/schema/actions/types';
import { arrayify } from '../../../utils/basic';
import type { CardActionsAPI } from '../../types';
import { ActionFactory, type ActionFactoryOptions } from '../factory';
import type { ActionPrepareCallback } from '../types';

interface ActionSetOptions {
  factoryOptions?: ActionFactoryOptions;
  actionPrepareCallback?: ActionPrepareCallback;
}

export class ActionSet {
  private _context: ActionContext;
  private _actions: ActionConfig[];
  private _factoryOptions?: ActionFactoryOptions;
  private _actionPrepareCallback?: ActionPrepareCallback;
  private _factory = new ActionFactory();
  private _stopped = false;

  constructor(
    context: ActionContext,
    actions: ActionConfig | ActionConfig[],
    options?: ActionSetOptions,
  ) {
    this._context = context;
    this._actions = arrayify(actions);
    this._actionPrepareCallback = options?.actionPrepareCallback;
    this._factoryOptions = options?.factoryOptions;
  }

  public async execute(api: CardActionsAPI): Promise<void> {
    for (const action of this._actions) {
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
        if (this._actionPrepareCallback) {
          concreteAction.prepare(this._actionPrepareCallback);
        }
        await concreteAction.execute(api);
      }
    }
  }

  public async stop(): Promise<void> {
    this._stopped = true;
  }
}
