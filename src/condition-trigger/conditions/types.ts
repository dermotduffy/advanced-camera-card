import type { HASSReadiness } from '../../card-controller/hass/types';
import type { KeysState, MicrophoneState } from '../../card-controller/types';
import type { AdvancedCameraCardView } from '../../config/schema/common/const';
import type { ViewDisplayMode } from '../../config/schema/common/display';
import type { CallPhase } from '../../config/schema/condition-trigger/common/call';
import type { AdvancedCameraCardConfig } from '../../config/schema/types';
import type { HomeAssistant } from '../../ha/types';
import type { MediaLoadedInfo } from '../../types';

// ConditionStateManager checks each written field with lodash isEqual, except
// for the fields listed in REFERENCE_COMPARED_KEYS (state-manager.ts), which
// are compared by reference instead. Prefer plain immutable data: functions
// (callbacks) compare by identity, and opaque objects get deep-walked through
// their enumerable state, which is rarely a meaningful equality contract, and
// can be actively expensive (see `hass`, below). Store such a value only when
// its reference is the intended state (`mediaLoadedInfo`'s
// MediaPlayerController, which consumers also reference-compare) or its
// identity is stable across writes (`hass`'s methods).
//
// Counterexample: Rebuilding an equivalent function callback each write making
// the field look changed when nothing observable did.
export interface ConditionState {
  call?: CallPhase;
  camera?: string;
  // The engaged substream for the selected camera (absent when the camera's own
  // stream is used).
  substreamID?: string;
  config?: AdvancedCameraCardConfig;
  displayMode?: ViewDisplayMode;
  expand?: boolean;
  fullscreen?: boolean;
  interaction?: boolean;
  keys?: KeysState;
  mediaLoadedInfo?: MediaLoadedInfo | null;
  microphone?: MicrophoneState;
  panel?: boolean;

  // Home Assistant:
  // - The main HA object itself. Compared by reference (REFERENCE_COMPARED_KEYS
  //   in state-manager.ts), not deep-equal -- `hass.states` can hold thousands
  //   of entities, and HASSManager only ever assigns a new `hass` when Home
  //   Assistant itself reports a change, so identity is a correct and much
  //   cheaper proxy for "did anything change".
  hass?: HomeAssistant;
  // - The card's view of HA's readiness.
  hassReadiness?: HASSReadiness;

  // Initialization:
  // - Currently initialized.
  initialized?: boolean;
  // - Ever initialized.
  everInitialized?: boolean;

  // Generic media target identifier. See @view/target-id for details.
  targetID?: string;
  triggered?: ReadonlySet<string>;
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
