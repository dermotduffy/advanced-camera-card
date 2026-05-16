export interface CallSession {
  // The camera that owns the call.
  cameraID: string;

  // The substream carrying the 2-way audio: a 2-way-audio-capable
  // substream/dependency of `cameraID`. Absent when the call runs on
  // `cameraID`'s own stream.
  callCameraID?: string;

  // An optional substream override that was active on `cameraID` before the
  // call started, restored when the call ends.
  previousStream?: string;
}
