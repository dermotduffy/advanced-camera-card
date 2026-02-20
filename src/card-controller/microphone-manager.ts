import { errorToConsole } from '../utils/basic';
import { Timer } from '../utils/timer';
import { CardMicrophoneAPI, MicrophoneState } from './types';

export class MicrophoneManager {
  private _api: CardMicrophoneAPI;
  private _stream?: MediaStream | null;
  private _timer = new Timer();

  private _state: MicrophoneState = {
    connected: false,
    muted: true,
    forbidden: false,
  };

  // We keep desired mute state separate from the overall state so that
  // mute/unmute can be expressed before the stream is even created -- and when
  // it's created it will have the right mute status.
  private _desireMute = true;

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

  public async connect(): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }

    try {
      this._stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
    } catch (e: unknown) {
      errorToConsole(e as Error);

      this._stream = null;
      this._setState();
      return false;
    }
    this._setDesiredMuteOnStream();
    this._setState();
    return true;
  }

  public disconnect(): void {
    this._stream?.getTracks().forEach((track) => track.stop());

    this._stream = undefined;
    this._setState();
  }

  public getStream(): MediaStream | undefined {
    return this._stream ?? undefined;
  }

  public mute(): void {
    this._desireMute = true;
    this._setDesiredMuteOnStream();
    this._setState();
  }

  public async unmute(): Promise<void> {
    if (!this.isSupported()) {
      return;
    }

    this._desireMute = false;

    if (!this.isConnected() && !this.isForbidden()) {
      // Connecting will automatically set the desired mute.
      await this.connect();
    } else if (this.isConnected()) {
      this._setDesiredMuteOnStream();
      this._setState();
    }
  }

  public isConnected(): boolean {
    return !!this._stream;
  }

  public isForbidden(): boolean {
    return this._stream === null;
  }

  public isMuted(): boolean {
    // For safety, this function always returns the stream mute status directly
    // (rather the desired internal state).
    return !this._stream || this._stream.getTracks().every((track) => !track.enabled);
  }

  private _setDesiredMuteOnStream(): void {
    this._stream?.getTracks().forEach((track) => {
      track.enabled = !this._desireMute;
    });

    this._startDisconnectTimer();
  }

  private _startDisconnectTimer(): void {
    const microphoneConfig = this._api.getConfigManager().getConfig()?.live.microphone;

    if (microphoneConfig?.always_connected) {
      return;
    }

    const disconnectSeconds = microphoneConfig?.disconnect_seconds ?? 0;

    if (disconnectSeconds) {
      this._timer.start(disconnectSeconds, () => {
        this.disconnect();
      });
    }
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
