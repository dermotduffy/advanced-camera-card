import { AdvancedCameraCardError } from '../../types.js';
import { ActionConfig, AuxillaryActionConfig } from '../../config/types';
import { CardActionsAPI } from '../types';

export interface Action {
  execute(api: CardActionsAPI): Promise<void>;
  stop(): Promise<void>;
}

export interface ActionExecutionRequest {
  action: ActionConfig[] | ActionConfig;
  config?: AuxillaryActionConfig;
}

export interface TargetedActionContext {
  [targetID: string]: {
    inProgressAction?: Action;
  };
}

export class ActionAbortError extends AdvancedCameraCardError {}
