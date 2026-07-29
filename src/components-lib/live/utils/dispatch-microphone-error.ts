import { fireAdvancedCameraCardEvent } from '../../../utils/fire-advanced-camera-card-event';

// What a provider knows about its own microphone related failure. Stream
// otherwise not impacted (contrast with `live:error`: which marks the whole
// stream not live).
export interface MicrophoneError {
  // The base camera the provider is rendering. Carried because this event is
  // handled once for the whole card, unlike `live:error` which is caught and
  // stopped on the camera's own provider wrapper and so needs no camera named.
  targetID: string;

  // Free text naming the specific failure, when the provider has one.
  description?: string;
}

declare global {
  interface HTMLElementEventMap {
    'advanced-camera-card:microphone:error': CustomEvent<MicrophoneError>;
  }
}

export function dispatchMicrophoneErrorEvent(
  element: EventTarget,
  error: MicrophoneError,
): void {
  fireAdvancedCameraCardEvent<MicrophoneError>(element, 'microphone:error', error);
}
