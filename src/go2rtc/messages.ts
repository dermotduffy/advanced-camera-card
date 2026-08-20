import { z } from 'zod';

// go2rtc control messages are JSON text frames of this shape; media flows as
// separate binary frames.
export const go2RTCMessageSchema = z.object({
  type: z.string(),

  // Per-type payload (a codec list, an SDP, an ICE candidate, error text, ...):
  // absent for some types (e.g. mjpeg) and not always a string, so it is typed
  // `unknown` and each handler narrows it before use.
  value: z.unknown().optional(),
});
export type Go2RTCMessage = z.infer<typeof go2RTCMessageSchema>;

export type MessageCallback = (message: Go2RTCMessage) => void;
export type BinaryCallback = (data: ArrayBuffer) => void;

// The go2rtc server reports a mode failure as `{ type: 'error', value: '<mode>:
// ...' }` (e.g. `mse: stream not found`), so an error is for a given mode when
// its value starts with that mode's name.
export const isServerErrorForMode = (message: Go2RTCMessage, mode: string): boolean =>
  message.type === 'error' &&
  typeof message.value === 'string' &&
  message.value.startsWith(mode);
