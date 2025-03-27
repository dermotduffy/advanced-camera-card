import { ConditionsTriggerData } from '../../conditions/types.js';
import {
  ActionConfig,
  AuxillaryActionConfig,
} from '../../config/schema/actions/types.js';
import { AdvancedCameraCardError } from '../../types.js';
import { CardActionsAPI } from '../types';

export interface Action {
  execute(api: CardActionsAPI): Promise<void>;
  stop(): Promise<void>;
}

export interface ActionsExecutionRequest {
  actions: ActionConfig[] | ActionConfig;
  config?: AuxillaryActionConfig;
  triggerData?: ConditionsTriggerData;
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
