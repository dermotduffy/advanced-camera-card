export type LiveEdgeAction =
  | { action: 'none' }
  | { action: 'rate'; rate: number }
  | { action: 'seek'; seconds: number };

export interface LiveEdgeStatus {
  bufferedEndSeconds: number;
  currentTimeSeconds: number;
  playbackRate: number;
  now: Date;
}

// Given the current live-edge lag, returns the action needed to stay near the
// edge (a seek, a playback-rate nudge, or nothing).
export interface LiveEdgeStrategy {
  next(status: LiveEdgeStatus): LiveEdgeAction;
}
