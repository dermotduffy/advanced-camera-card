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
