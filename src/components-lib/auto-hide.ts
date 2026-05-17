import { AutoHideCondition } from '../config/schema/common/auto-hide';

// Whether each auto-hide condition is currently active.
export interface AutoHideState {
  call: boolean;
  casting: boolean;
}

export const isAutoHidden = (
  autoHide: readonly AutoHideCondition[],
  state: AutoHideState,
): boolean => autoHide.some((condition) => state[condition]);
