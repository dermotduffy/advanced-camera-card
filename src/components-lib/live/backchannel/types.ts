export type BackchannelFailureReason =
  | 'no_two_way_audio'
  | 'no_microphone'
  | 'failed'
  | 'abandoned';

export class BackchannelError extends Error {
  public readonly reason: BackchannelFailureReason;
  public readonly description: string | null;

  constructor(reason: BackchannelFailureReason, description?: string) {
    super(description ?? reason);
    this.reason = reason;
    this.description = description ?? null;
  }
}

// An outbound audio path from the browser microphone to a camera held for the
// duration of a call. Implementations are per live provider.
export interface Backchannel {
  // Opens the path carrying the given microphone stream. Resolves once the
  // camera can actually be spoken to.
  start(stream: MediaStream): Promise<void>;

  // Swaps the microphone stream being carried, leaving the path open.
  setStream(stream: MediaStream): Promise<void>;

  // Closes the path, releasing the camera (the microphone itself belongs to
  // MicrophoneManager and is untouched).
  stop(): void;
}

export type BackchannelErrorCallback = (error: BackchannelError) => void;
