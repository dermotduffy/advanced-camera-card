import { AutoHideCondition } from '../config/schema/common/auto-hide';
import { isBeingCasted } from '../utils/casting';

// Whether each auto-hide condition is currently active.
export interface AutoHideState {
  call: boolean;
  casting: boolean;
}

// Single constructor for the auto-hide state. `casting` is read from the
// environment; `call` is the only context-specific input, supplied by the
// caller (absent when no call notion applies, e.g. the media viewer).
export const resolveAutoHideState = (callActive = false): AutoHideState => ({
  call: callActive,
  casting: isBeingCasted(),
});

export const isAutoHidden = (
  autoHide: readonly AutoHideCondition[],
  state: AutoHideState,
): boolean => autoHide.some((condition) => state[condition]);
