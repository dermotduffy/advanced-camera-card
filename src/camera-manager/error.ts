import { localize } from '../localize/localize.js';
import { AdvancedCameraCardError } from '../types.js';

// An initialization failure the user has to act on (e.g. a misconfiguration).
// Distinct from Home Assistant being temporarily unable to answer, which is
// re-attempted rather than reported as a hard failure.
export class CameraInitializationError extends AdvancedCameraCardError {}

export class CameraNoEngineError extends CameraInitializationError {
  constructor(context?: unknown) {
    super(localize('error.no_camera_engine'), context);
  }
}

export class CameraNoIDError extends CameraInitializationError {
  constructor(context?: unknown) {
    super(localize('error.no_camera_id'), context);
  }
}

export class CameraDuplicateIDError extends CameraInitializationError {
  constructor(context?: unknown) {
    super(localize('error.duplicate_camera_id'), context);
  }
}

export class CameraNoEntityError extends CameraInitializationError {
  constructor(context?: unknown) {
    super(localize('error.no_camera_entity'), context);
  }
}

export class ReolinkInitializationError extends CameraInitializationError {
  constructor(context?: unknown) {
    super(localize('error.camera_initialization_reolink'), context);
  }
}
