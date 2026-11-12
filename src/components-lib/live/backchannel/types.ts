import { AdvancedCameraCardError } from '../../../types';

export type BackchannelFailureReason =
  | 'no_two_way_audio'
  | 'no_microphone'
  | 'disconnected'
  | 'failed';

export class BackchannelError extends AdvancedCameraCardError {
  public readonly reason: BackchannelFailureReason;
  public readonly description: string | null;

  constructor(reason: BackchannelFailureReason, description?: string) {
    super(description ?? reason);
    this.reason = reason;
    this.description = description ?? null;
  }
}

// Rejects a `start()` that `stop()` or a newer `start()` cut short. Nothing
// failed, so there is no reason to report.
export class BackchannelAbandonedError extends AdvancedCameraCardError {
  constructor() {
    super('Backchannel abandoned');
  }
}

// Carries audio from the browser microphone to a camera, held for the
// duration of a call. Implementations are per live provider.
export interface Backchannel {
  // Opens the backchannel carrying the given microphone stream. Resolves once the
  // camera can actually be spoken to.
  start(stream: MediaStream): Promise<void>;

  // Swaps the microphone stream being carried, leaving the backchannel open.
  setStream(stream: MediaStream): Promise<void>;

  // Closes the backchannel, releasing the camera (the microphone itself belongs to
  // MicrophoneManager and is untouched).
  stop(): void;
}

export type BackchannelErrorCallback = (error: BackchannelError) => void;
