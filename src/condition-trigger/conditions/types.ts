import { IssuePresence } from '../../card-controller/issues/types';
import { KeysState, MicrophoneState } from '../../card-controller/types';
import { AdvancedCameraCardView } from '../../config/schema/common/const';
import { ViewDisplayMode } from '../../config/schema/common/display';
import { AdvancedCameraCardConfig } from '../../config/schema/types';
import { HomeAssistant } from '../../ha/types';
import { MediaLoadedInfo } from '../../types';

export interface ConditionState {
  call?: boolean;
  camera?: string;
  // The engaged substream for the selected camera (absent when the camera's own
  // stream is used).
  substreamID?: string;
  config?: AdvancedCameraCardConfig;
  displayMode?: ViewDisplayMode;
  expand?: boolean;
  fullscreen?: boolean;
  initialized?: boolean;
  interaction?: boolean;
  keys?: KeysState;
  mediaLoadedInfo?: MediaLoadedInfo | null;
  microphone?: MicrophoneState;
  panel?: boolean;
  issues?: IssuePresence;
  hass?: HomeAssistant;

  // Generic media target identifier. See @view/target-id for details.
  targetID?: string;
  triggered?: Set<string>;
  userAgent?: string;
  view?: AdvancedCameraCardView;
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

export interface ConditionsEvaluationResult {
  result: boolean;

  // Whether the condition's watched input transitioned during this evaluation
  // (an edge), even when `result` is unchanged.
  changed?: boolean;
}

// The `stateChange` that prompted the evaluation is forwarded so a trigger can
// build its payload from the raw before/after state; condition consumers
// (elements, overrides) simply ignore it.
export type ConditionsListener = (
  result: ConditionsEvaluationResult,
  stateChange?: ConditionStateChange,
) => void;

export interface ConditionsManagerReadonlyInterface {
  addListener(listener: ConditionsListener): void;
  removeListener(listener: ConditionsListener): void;
  getEvaluation(): ConditionsEvaluationResult | null;
}
