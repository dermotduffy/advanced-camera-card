import type { KeysState, MicrophoneState } from '../../card-controller/types';
import type { AdvancedCameraCardView } from '../../config/schema/common/const';
import type { ViewDisplayMode } from '../../config/schema/common/display';
import type { AdvancedCameraCardConfig } from '../../config/schema/types';
import type { HomeAssistant } from '../../ha/types';
import type { MediaLoadedInfo } from '../../types';

// ConditionStateManager checks each written field with lodash isEqual. Prefer
// plain immutable data: functions (callbacks) compare by identity, and opaque
// objects get deep-walked through their enumerable state, which is rarely a
// meaningful equality contract. Store such a value only when its reference is
// the intended state (`mediaLoadedInfo`'s MediaPlayerController, which
// consumers also reference-compare) or its identity is stable across writes
// (`hass`'s methods).
//
// Counterexample: Rebuilding an equivalent function callback each write making
// the field look changed when nothing observable did.
export interface ConditionState {
  call?: { active: boolean; answered: boolean };
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
