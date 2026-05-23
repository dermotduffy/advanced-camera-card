import { View } from '../../view/view';

export interface CallSession {
  // The camera that owns the call.
  cameraID: string;

  // The substream carrying the 2-way audio: a 2-way-audio-capable
  // substream/dependency of `cameraID`. Absent when the call runs on
  // `cameraID`'s own stream.
  callCameraID?: string;

  // The view from before the call started: a clone with `queryResults` dropped.
  // Used to undo the call when it ends.
  previousView: View;

  // Marks the session as inbound (auto-started, typically by a trigger) rather
  // than the result of an explicit user gesture.
  inbound: boolean;

  // Whether the use has "answered" an inbound call.
  answered: boolean;
}
