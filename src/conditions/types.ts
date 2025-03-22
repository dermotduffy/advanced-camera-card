import { HassEntities } from 'home-assistant-js-websocket';
import { KeysState, MicrophoneState } from '../card-controller/types';
import { ViewDisplayMode } from '../config/schema/common/display';
import { AdvancedCameraCardConfig } from '../config/schema/types';
import { CurrentUser } from '../ha/types';
import { MediaLoadedInfo } from '../types';

export interface ConditionState {
  camera?: string;
  config?: AdvancedCameraCardConfig;
  displayMode?: ViewDisplayMode;
  expand?: boolean;
  fullscreen?: boolean;
  initialized?: boolean;
  interaction?: boolean;
  keys?: KeysState;
  mediaLoadedInfo?: MediaLoadedInfo | null;
  microphone?: MicrophoneState;
  state?: HassEntities;
  triggered?: Set<string>;
  user?: CurrentUser;
  userAgent?: string;
  view?: string;
}

export interface ConditionStateChange {
  old: ConditionState;
  change: ConditionState;
  new: ConditionState;
}

export type ConditionStateListener = (change: ConditionStateChange) => void;

export interface ConditionStateManagerReadonlyInterface {
  addListener(listener: ConditionStateListener): void;
  removeListener(listener: ConditionStateListener): void;
  getState(): ConditionState;
}

interface ConditionsTriggerDataFromTo {
  from?: string;
  to?: string;
}

interface ConditionsTriggerDataState extends ConditionsTriggerDataFromTo {
  entity: string;
}

interface ConditionsTriggerDataConfig {
  from?: AdvancedCameraCardConfig;
  to?: AdvancedCameraCardConfig;
}

export interface ConditionsTriggerData {
  camera?: ConditionsTriggerDataFromTo;
  view?: ConditionsTriggerDataFromTo;
  state?: ConditionsTriggerDataState;
  config?: ConditionsTriggerDataConfig;
}
export interface ConditionsEvaluationResult {
  result: boolean;

  // Trigger data is only provided if there was a real change of state (For
  // example: if a state condition that matches 'on' previously evaluated to
  // true, and a call from the state manager arrives for an unrelated hass state
  // update, the condition will still evaluate true, but there won't be any
  // trigger data provided since the state relevant to the condition did not
  // change).
  triggerData?: ConditionsTriggerData;
}

export type ConditionsListener = (result: ConditionsEvaluationResult) => void;

export interface ConditionsManagerReadonlyInterface {
  addListener(listener: ConditionsListener): void;
  removeListener(listener: ConditionsListener): void;
  getEvaluation(): ConditionsEvaluationResult | null;
}
