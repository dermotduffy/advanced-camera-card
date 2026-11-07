import type { PeerConnectionFactory } from '../../../go2rtc/peer-connection';
import { getErrorDescription } from '../../../utils/basic';
import { Generation } from '../../../utils/concurrency/generation';
import { Timer } from '../../../utils/timer';
import {
  BackchannelError,
  type Backchannel,
  type BackchannelErrorCallback,
} from './types';

const BACKCHANNEL_CONNECT_TIMEOUT_SECONDS = 10;

const toBackchannelError = (error: unknown): BackchannelError =>
  error instanceof BackchannelError
    ? error
    : new BackchannelError('failed', getErrorDescription(error) ?? undefined);

interface PendingStart {
  resolve: () => void;
  reject: (error: BackchannelError) => void;
}

// A backchannel carried by a WebRTC connection of its own that only sends the
// microphone's audio. This holds what every such connection shares: the
// connect timeout, the microphone track and its replacement, the connection
// state, and the teardown. Subclasses negotiate the connection, each over its
// own signaling path, and close that path.
export abstract class PeerConnectionBackchannel implements Backchannel {
  protected _generation = new Generation();
  protected _pc: RTCPeerConnection | null = null;
  protected _transceiver: RTCRtpTransceiver | null = null;

  private _errorCallback: BackchannelErrorCallback | null;
  private _connectTimer = new Timer();
  private _outboundTrack: MediaStreamTrack | null = null;

  // `start()` cannot determine its own outcome: the camera is only known to be
  // reachable once the peer connection reports `connected`, and the signaling
  // path may refuse in a message that arrives even later. Whichever handler
  // learns the outcome completes `start()` through these.
  private _pendingStart: PendingStart | null = null;

  constructor(errorCallback?: BackchannelErrorCallback) {
    this._errorCallback = errorCallback ?? null;
  }

  public start(stream: MediaStream): Promise<void> {
    this.stop();

    const generation = this._generation.next();

    // Both exist before the first await: a timeout cannot end a wait unless the
    // promise it rejects has already been created.
    return new Promise<void>((resolve, reject) => {
      this._pendingStart = { resolve, reject };

      this._connectTimer.start(BACKCHANNEL_CONNECT_TIMEOUT_SECONDS, () =>
        this._failStart(generation, new BackchannelError('failed')),
      );

      this._startWithStream(stream, generation).catch((error: unknown) =>
        this._failStart(generation, toBackchannelError(error)),
      );
    });
  }

  private async _startWithStream(
    stream: MediaStream,
    generation: number,
  ): Promise<void> {
    // A microphone stream carries exactly one audio track.
    const track = stream.getAudioTracks()[0] ?? null;
    if (!track || track.readyState === 'ended') {
      throw new BackchannelError('no_microphone');
    }
    await this._connect(track, generation);
  }

  // Opens the connection for `track`: creates it with `_createPeerConnection`
  // and negotiates it over the subclass's signaling path. Throwing, or calling
  // `_failStart`, fails the start.
  protected abstract _connect(
    track: MediaStreamTrack,
    generation: number,
  ): Promise<void>;

  // Closes the subclass's signaling path; part of every teardown.
  protected abstract _closeSignaling(): void;

  // Called once the camera can be spoken to.
  protected _handleConnected(): void {}

  protected _createPeerConnection(
    createPeerConnection: PeerConnectionFactory,
    configuration: RTCConfiguration,
    track: MediaStreamTrack,
    generation: number,
  ): RTCPeerConnection {
    const pc = createPeerConnection(configuration);
    this._pc = pc;

    // This connection only sends audio.
    this._transceiver = pc.addTransceiver(track, { direction: 'sendonly' });
    this._watchTrack(track);

    pc.addEventListener('connectionstatechange', () =>
      this._handleConnectionStateChange(pc, generation),
    );
    return pc;
  }

  public async setStream(stream: MediaStream): Promise<void> {
    const transceiver = this._transceiver;

    // Nothing to swap onto: the call this belonged to has already ended.
    if (!transceiver) {
      return;
    }

    // A microphone stream carries exactly one audio track. Detaching the sender
    // instead would leave the user believing they can be heard.
    const track = stream.getAudioTracks()[0] ?? null;
    if (!track || track.readyState === 'ended') {
      throw new BackchannelError('no_microphone');
    }

    const generation = this._generation.current();
    await transceiver.sender.replaceTrack(track);
    // A stop (or a new start) while the track was being swapped leaves nothing
    // for this track to report to.
    if (this._generation.isCurrent(generation)) {
      this._watchTrack(track);
    }
  }

  public stop(): void {
    this._generation.invalidate();
    this._connectTimer.stop();

    const pendingStart = this._pendingStart;
    this._pendingStart = null;

    this._closeSignaling();
    this._unwatchTrack();

    // Closing the peer connection is what releases the camera's backchannel.
    // The outbound track keeps running: MicrophoneManager owns the microphone
    // and shares it across cameras.
    // See https://github.com/dermotduffy/advanced-camera-card/issues/1810
    this._pc?.close();
    this._pc = null;
    this._transceiver = null;

    pendingStart?.reject(new BackchannelError('abandoned'));
  }

  private _handleTrackEnded = (): void =>
    this._reportLost(this._generation.current(), new BackchannelError('no_microphone'));

  private _watchTrack(track: MediaStreamTrack): void {
    this._unwatchTrack();
    track.addEventListener('ended', this._handleTrackEnded);
    this._outboundTrack = track;
  }

  private _unwatchTrack(): void {
    this._outboundTrack?.removeEventListener('ended', this._handleTrackEnded);
    this._outboundTrack = null;
  }

  // Ends the backchannel for a reason found after it may have started: fails
  // `start()` if it is still pending, and otherwise tells the error callback.
  protected _reportLost(generation: number, error: BackchannelError): void {
    if (this._pendingStart) {
      this._failStart(generation, error);
      return;
    }
    this.stop();
    this._errorCallback?.(error);
  }

  private _handleConnectionStateChange(pc: RTCPeerConnection, generation: number): void {
    if (!this._generation.isCurrent(generation)) {
      return;
    }

    if (pc.connectionState === 'connected') {
      const direction = this._transceiver?.currentDirection;
      if (direction !== 'sendonly' && direction !== 'sendrecv') {
        this._failStart(generation, new BackchannelError('no_two_way_audio'));
        return;
      }

      this._connectTimer.stop();
      this._handleConnected();

      this._pendingStart?.resolve();
      this._pendingStart = null;
    } else if (pc.connectionState === 'failed') {
      this._reportLost(generation, new BackchannelError('failed'));
    }
  }

  // Aborts an in-progress `start()`. Every failure before `start()` resolves
  // arrives here; afterwards there is no request left to fail.
  protected _failStart(generation: number, error: BackchannelError): void {
    if (!this._generation.isCurrent(generation)) {
      return;
    }
    // Taken before the teardown so this reason is reported rather than the
    // abandonment `stop()` would otherwise report.
    const pendingStart = this._pendingStart;
    this._pendingStart = null;
    this.stop();
    pendingStart?.reject(error);
  }
}
