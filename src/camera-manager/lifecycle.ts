import type { CameraManager } from './manager';

export enum CameraLifecycleStatus {
  Initializing = 'initializing',
  Ready = 'ready',
  Failed = 'failed',
}

export interface CameraLifecycleState {
  status: CameraLifecycleStatus;

  // The initialization failure, when the status is failed.
  error?: unknown;
}

// Replaced with a fresh object whenever a camera's lifecycle state changes, so
// a Lit component that receives the same CameraManager reference still
// observes a changed property and re-renders.
export interface CameraManagerEpoch {
  manager: CameraManager;
}
