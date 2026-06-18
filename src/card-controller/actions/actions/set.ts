import { ActionContext } from 'action';
import { ActionConfig } from '../../../config/schema/actions/types';
import { arrayify } from '../../../utils/basic';
import { CardActionsAPI } from '../../types';
import { ActionFactory, ActionFactoryOptions } from '../factory';
import { Action } from '../types';

// Callback to render an action's templates immediately before it executes.
export type ActionPrepareCallback = (action: ActionConfig) => ActionConfig;

interface ActionSetOptions {
  factoryOptions?: ActionFactoryOptions;
  prepareCallback?: ActionPrepareCallback;
}

export class ActionSet implements Action {
  private _context: ActionContext;
  private _actions: ActionConfig[];
  private _factoryOptions?: ActionFactoryOptions;
  private _prepareCallback?: ActionPrepareCallback;
  private _factory = new ActionFactory();
  private _stopped = false;

  constructor(
    context: ActionContext,
    actions: ActionConfig | ActionConfig[],
    options?: ActionSetOptions,
  ) {
    this._context = context;
    this._actions = arrayify(actions);
    this._prepareCallback = options?.prepareCallback;
    this._factoryOptions = options?.factoryOptions;
  }

  public async execute(api: CardActionsAPI): Promise<void> {
    for (const action of this._actions) {
      if (this._stopped) {
        break;
      }

      // Render against the state as it is now, so an action observes what an
      // earlier action in the sequence changed. A render error aborts the
      // remainder of the sequence (it propagates to the caller's handler).
      const concreteAction = this._factory.createAction(
        this._context,
        this._prepareCallback ? this._prepareCallback(action) : action,
        this._factoryOptions,
      );
      if (concreteAction) {
        await concreteAction.execute(api);
      }
    }
  }

  public async stop(): Promise<void> {
    this._stopped = true;
  }
}
