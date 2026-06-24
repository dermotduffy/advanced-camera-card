import type { TriggerData } from '../../condition-trigger/triggers/types.js';
import type {
  ActionConfig,
  AuxillaryActionConfig,
} from '../../config/schema/actions/types.js';
import { AdvancedCameraCardError } from '../../types.js';
import type { CardActionsAPI } from '../types';

// Renders a value's templates, returning a rendered copy. Generic so it
// preserves the value's type (the one cast lives in the renderer that supplies
// it).
export type ActionPrepareCallback = <T>(value: T) => T;

export interface Action {
  // Prepare this action for execution by rendering its templates against the
  // current state. The rendered copy is stored separately; the original config
  // is left intact, so the action stays reusable. Structural actions (`if`)
  // override this to leave their nested action sequences raw, so those render
  // per-step when their branch runs.
  prepare(actionPrepareCallback: ActionPrepareCallback): void;
  execute(api: CardActionsAPI): Promise<void>;
  stop(): Promise<void>;
}

export interface ActionsExecutionRequest {
  actions: ActionConfig[] | ActionConfig;
  config?: AuxillaryActionConfig;
  triggerData?: TriggerData;
}

export interface ActionsExecutor {
  executeActions(request: ActionsExecutionRequest): Promise<void>;
}

export interface TargetedActionContext {
  [targetID: string]: {
    inProgressAction?: Action;
  };
}

export class ActionAbortError extends AdvancedCameraCardError {}
