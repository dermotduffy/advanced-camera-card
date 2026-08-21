import { localize } from '../localize/localize';
import { AdvancedCameraCardError } from '../types';
import { Generation } from '../utils/concurrency/generation';
import type { CardMicrophoneAPI, MicrophoneState } from './types';

export class MicrophoneNotSupportedError extends AdvancedCameraCardError {
  constructor() {
    super(localize('error.microphone_not_supported'));
  }
}

export class MicrophoneManager {
  private _api: CardMicrophoneAPI;
  private _stream: MediaStream | null = null;

  // Whether the browser denied the most recent microphone request. Cleared by
  // a later successful connect.
  private _forbidden = false;

  private _state: MicrophoneState = {
    connected: false,
    muted: true,
    forbidden: false,
  };

  // We keep desired mute state separate from the overall state so that
  // mute/unmute can be expressed before the stream is even created -- and when
  // it's created it will have the right mute status.
  private _desireMute = true;

  // Whether an outgoing audio path is active, i.e. something is consuming the
  // microphone stream. While active, mute only disables the tracks so unmute is
  // instant; while inactive, a muted microphone is released outright.
  private _transmissionActive = false;

  // Guards in-flight getUserMedia requests: a result that resolves after a
  // newer connect or a release must not be installed.
  private _connectGeneration = new Generation();

  constructor(api: CardMicrophoneAPI) {
    this._api = api;
  }

  public getState(): MicrophoneState {
    return this._state;
  }

  public initialize(): void {
    this._setState();
  }

  public shouldConnectOnInitialization(): boolean {
    return (
      !!this._api.getConfigManager().getConfig()?.live.microphone?.always_connected &&
      // If it won't be possible to connect the microphone at all, we do not
      // block the initialization of the card (the microphone just won't work)
      this.isSupported()
    );
  }

  public isSupported(): boolean {
    // Some browsers will have mediaDevices/getUserMedia as undefined if
    // accessed over http.
    // See: https://github.com/dermotduffy/advanced-camera-card/issues/1543
    return !!navigator.mediaDevices?.getUserMedia;
  }

  // Returns true iff the microphone is connected when this request completes:
  // a request superseded by a newer connect or a release resolves false, as
  // does one whose stream is immediately released for want of an active
  // transmission. A denied request throws.
  public async connect(): Promise<boolean> {
    if (!this.isSupported()) {
      throw new MicrophoneNotSupportedError();
    }

    const generation = this._connectGeneration.next();

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
    } catch (e: unknown) {
      // A stale rejection must not mark the microphone forbidden.
      if (this._connectGeneration.isCurrent(generation)) {
        this._releaseStream();
        this._forbidden = true;
        this._setState();
      }
      throw e;
    }

    if (!this._connectGeneration.isCurrent(generation)) {
      // Superseded while the permission prompt was up: this stream must not
      // survive as an open capture nothing is tracking.
      this._stopTracks(stream);
      return false;
    }

    // A connect over an existing stream must not leak the tracks of the
    // stream it replaces.
    this._removeEndedListeners(this._stream);
    this._stopTracks(this._stream);
    this._stream = stream;
    this._addEndedListeners(stream);
    this._forbidden = false;
    this._reconcile();
    this._setState();
    return this.isConnected();
  }

  // Reports whether an outgoing audio path is active. When transmission ends,
  // the microphone returns to muted and -- unless `always_connected` -- the
  // device is released.
  public setTransmissionActive(transmissionActive: boolean): void {
    if (this._transmissionActive === transmissionActive) {
      return;
    }
    this._transmissionActive = transmissionActive;
    if (!transmissionActive) {
      this._desireMute = true;
    }
    this._reconcile();
    this._setState();
  }

  public getStream(): MediaStream | null {
    return this._stream;
  }

  public mute(): void {
    this._desireMute = true;
    this._reconcile();
    this._setState();
  }

  public async unmute(): Promise<void> {
    // An unmute without an active outgoing audio path is meaningless: nothing
    // consumes the stream, so enabling (or creating) a capture would only light
    // the browser recording indicator.
    if (!this.isSupported() || !this._transmissionActive) {
      return;
    }

    this._desireMute = false;

    if (!this.isConnected() && !this.isForbidden()) {
      // Connecting applies the desired mute to the new stream.
      await this.connect();
      return;
    }
    this._reconcile();
    this._setState();
  }

  public isConnected(): boolean {
    return !!this._stream;
  }

  public isForbidden(): boolean {
    return this._forbidden;
  }

  public isMuted(): boolean {
    // For safety, this function always returns the stream mute status directly
    // (rather the desired internal state).
    return !this._stream || this._stream.getTracks().every((track) => !track.enabled);
  }

  private _stopTracks(stream: MediaStream | null): void {
    stream?.getTracks().forEach((track) => track.stop());
  }

  // A device that disappears -- unplugged, or its permission revoked -- ends
  // its tracks. Nothing can revive them, so the stream is dropped and the new
  // state published, rather than leaving the card reporting a connected
  // microphone that captures nothing. `stop()` does not fire this event, so
  // releasing the stream cannot re-enter.
  private _handleTrackEnded = (): void => {
    this._releaseStream();
    this._setState();
  };

  private _addEndedListeners(stream: MediaStream): void {
    stream
      .getTracks()
      .forEach((track) => track.addEventListener('ended', this._handleTrackEnded));
  }

  private _removeEndedListeners(stream: MediaStream | null): void {
    stream
      ?.getTracks()
      .forEach((track) => track.removeEventListener('ended', this._handleTrackEnded));
  }

  private _releaseStream(): void {
    this._connectGeneration.invalidate();
    this._removeEndedListeners(this._stream);
    this._stopTracks(this._stream);
    this._stream = null;
  }

  // The single place that applies microphone policy to the device: whether
  // the device is held or released, and whether its tracks are live. A muted
  // microphone with no active transmission is released entirely (turning the
  // browser recording indicator off) unless `always_connected`; while
  // transmission is active, mute only disables the tracks so unmute needs no
  // new permission request or renegotiation.
  private _reconcile(): void {
    if (!this._stream) {
      return;
    }
    const alwaysConnected = !!this._api.getConfigManager().getConfig()?.live.microphone
      ?.always_connected;
    if (this._desireMute && !this._transmissionActive && !alwaysConnected) {
      this._releaseStream();
      return;
    }
    this._stream.getTracks().forEach((track) => {
      track.enabled = !this._desireMute;
    });
  }

  private _setState(): void {
    this._state = {
      stream: this._stream,
      connected: this.isConnected(),
      muted: this.isMuted(),
      forbidden: this.isForbidden(),
    };
    this._api.getConditionStateManager().setState({
      microphone: this._state,
    });
    this._api.getCardElementManager().update();
  }
}
