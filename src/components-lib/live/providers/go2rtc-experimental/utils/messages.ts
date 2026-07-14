import type { Go2RTCMessage } from '../types';

// The go2rtc server reports a mode failure as `{ type: 'error', value: '<mode>: ...' }`
// (e.g. `mse: stream not found`), so an error is for a given mode when its value
// starts with that mode's name.
export const isServerErrorForMode = (message: Go2RTCMessage, mode: string): boolean =>
  message.type === 'error' &&
  typeof message.value === 'string' &&
  message.value.startsWith(mode);
