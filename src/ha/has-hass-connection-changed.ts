import { HomeAssistant } from './types';

/**
 * Determine if HA connection state has changed.
 * @param newHass The new HA object.
 * @param oldHass The old HA object.
 * @returns `true` if the connection state has changed.
 */
export const hasHAConnectionStateChanged = (
  oldHass?: HomeAssistant | null,
  newHass?: HomeAssistant | null,
): boolean => {
  return oldHass?.connected !== newHass?.connected;
};
