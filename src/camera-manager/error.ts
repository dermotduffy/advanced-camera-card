import { localize } from '../localize/localize.js';
import { AdvancedCameraCardError } from '../types.js';

class CameraInitializationError extends AdvancedCameraCardError {}

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
