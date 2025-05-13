import { STATES_ON } from './const';

/**
 * Determine if a given state qualifies as 'triggered'.
 * @param state The HA entity state string.
 * @returns `true` if triggered, `false` otherwise.
 */
export const isTriggeredState = (state?: string): boolean => {
  return !!state && STATES_ON.includes(state);
};
