import { ActionContext } from 'action';
import {
  ActionConfig,
  AuxillaryActionConfig,
} from '../../../config/schema/actions/types';
import { arrayify } from '../../../utils/basic';
import { CardActionsAPI } from '../../types';
import { ActionFactory } from '../factory';
import { Action } from '../types';

export class ActionSet implements Action {
  protected _context: ActionContext;
  protected _actions: Action[] = [];
  protected _factory = new ActionFactory();
  protected _stopped = false;

  constructor(
    context: ActionContext,
    actions: ActionConfig | ActionConfig[],
    options?: {
      config?: AuxillaryActionConfig;
      cardID?: string;
    },
  ) {
    this._context = context;
    for (const actionObj of arrayify(actions)) {
      const action = this._factory.createAction(context, actionObj, options);
      if (action) {
        this._actions.push(action);
      }
    }
  }

  public async execute(api: CardActionsAPI): Promise<void> {
    for (const action of this._actions) {
      if (this._stopped) {
        break;
      }

      await action.execute(api);
    }
  }

  public async stop(): Promise<void> {
    this._stopped = true;
  }
}
