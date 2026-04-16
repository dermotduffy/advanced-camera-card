import { CameraConfig } from '../config/schema/cameras';
import { localize } from '../localize/localize';
import { MediaLoadedInfo } from '../types';
import { getResolvedLiveProvider } from '../utils/live-provider';
import { hasSubstream } from '../utils/substream';
import { CallViewState } from '../utils/call';
import { CallClearViewModifier } from './view/modifiers/call-clear';
import { CallClearStateViewModifier } from './view/modifiers/call-clear-state';
import { CallSetViewModifier } from './view/modifiers/call-set';
import { CardCallAPI } from './types';

export type CallState = 'idle' | 'connecting_call' | 'in_call' | 'ending_call' | 'error';

export interface CallSessionState {
  state: CallState;
  camera?: string;
  stream?: string;
  lockNavigation: boolean;
  autoEnableMicrophone: boolean;
  autoEnableSpeaker: boolean;
  resumeNormalStreamOnEnd: boolean;
  endCallOnViewChange: boolean;
  message?: string;
}

const CALL_IDLE_STATE: CallSessionState = {
  state: 'idle',
  lockNavigation: false,
  autoEnableMicrophone: true,
  autoEnableSpeaker: true,
  resumeNormalStreamOnEnd: true,
  endCallOnViewChange: false,
};

export interface CallEndOptions {
  modifyViewContext?: boolean;
  preserveCallStream?: boolean;
}

export class CallManager {
  protected _api: CardCallAPI;
  protected _state: CallSessionState = { ...CALL_IDLE_STATE };
  protected _endOptions: Required<CallEndOptions> | null = null;

  constructor(api: CardCallAPI) {
    this._api = api;
  }

  public getState(): CallSessionState {
    return this._state;
  }

  public isActive(): boolean {
    return this._state.state !== 'idle';
  }

  public isNavigationLocked(): boolean {
    return this.isActive() && this._state.lockNavigation;
  }

  public shouldEndOnViewChange(): boolean {
    return this.isActive() && this._state.endCallOnViewChange;
  }

  public reset(): void {
    this._endOptions = null;
    this._setState({ ...CALL_IDLE_STATE });
  }

  public async startCall(): Promise<boolean> {
    if (this.isActive()) {
      return false;
    }

    const view = this._api.getViewManager().getView();
    if (!view?.is('live')) {
      return await this._fail(localize('error.call_mode_live_only'));
    }

    const cameraConfig = this._getActiveCameraConfig();
    if (!cameraConfig) {
      return await this._fail(localize('error.call_mode_live_only'));
    }

    const callModeConfig = cameraConfig.call_mode;
    if (!callModeConfig?.enabled) {
      return await this._fail(localize('error.call_mode_disabled'));
    }

    if (!callModeConfig.stream) {
      return await this._fail(localize('error.call_mode_no_stream'));
    }

    if (getResolvedLiveProvider(cameraConfig) !== 'go2rtc') {
      return await this._fail(localize('error.call_mode_provider_unsupported'));
    }

    if (hasSubstream(view)) {
      return await this._fail(localize('error.call_mode_substream_unsupported'));
    }

    await this._getMediaLoadedInfo(view.camera)?.mediaPlayerController?.mute();

    this._setCallContext({
      camera: view.camera,
      stream: callModeConfig.stream,
      state: 'connecting_call',
    });
    this._setState({
      state: 'connecting_call',
      camera: view.camera,
      stream: callModeConfig.stream,
      lockNavigation: callModeConfig.lock_navigation,
      autoEnableMicrophone: callModeConfig.auto_enable_microphone,
      autoEnableSpeaker: callModeConfig.auto_enable_speaker,
      resumeNormalStreamOnEnd: callModeConfig.resume_normal_stream_on_end,
      endCallOnViewChange: callModeConfig.end_call_on_view_change,
    });

    return true;
  }

  public async endCall(options?: CallEndOptions): Promise<boolean> {
    if (!this.isActive()) {
      return false;
    }

    const modifyViewContext = options?.modifyViewContext ?? true;
    const preserveCallStream =
      options?.preserveCallStream ?? !this._state.resumeNormalStreamOnEnd;

    this._endOptions = {
      modifyViewContext,
      preserveCallStream,
    };

    this._setState({
      ...this._state,
      state: 'ending_call',
      lockNavigation: false,
    });
    if (modifyViewContext) {
      this._setCallContext({ state: 'ending_call' });
    }

    this._api.getMicrophoneManager().mute();
    this._api.getMicrophoneManager().disconnect();
    await this._getMediaLoadedInfo(this._state.camera)?.mediaPlayerController?.mute();

    if (!modifyViewContext) {
      this.reset();
      return true;
    }

    if (preserveCallStream) {
      this._clearCallState();
      this.reset();
      return true;
    }

    this._clearCallContext();
    return true;
  }

  public async onMediaLoaded(
    mediaLoadedInfo: MediaLoadedInfo,
    cameraID?: string | null,
  ): Promise<void> {
    if (!this._matchesActiveCamera(cameraID)) {
      return;
    }

    if (this._state.state === 'connecting_call') {
      if (this._state.autoEnableSpeaker) {
        await mediaLoadedInfo.mediaPlayerController?.unmute();
      } else {
        await mediaLoadedInfo.mediaPlayerController?.mute();
      }

      if (this._state.autoEnableMicrophone) {
        await this._api.getMicrophoneManager().unmute();
      } else {
        this._api.getMicrophoneManager().mute();
      }

      this._setCallContext({ state: 'in_call' });
      this._setState({
        ...this._state,
        state: 'in_call',
      });
      return;
    }

    if (
      this._state.state === 'ending_call' &&
      this._endOptions?.modifyViewContext &&
      !this._endOptions.preserveCallStream
    ) {
      this.reset();
    }
  }

  public async onLiveError(cameraID?: string | null): Promise<void> {
    if (!this.isActive() || !this._matchesActiveCamera(cameraID)) {
      return;
    }

    if (this._state.state === 'ending_call') {
      this.reset();
      return;
    }

    await this._fail(localize('error.call_mode_stream_failed'));
  }

  protected _getActiveCameraConfig(): CameraConfig | null {
    const view = this._api.getViewManager().getView();
    if (!view) {
      return null;
    }
    return this._api.getCameraManager().getStore().getCameraConfig(view.camera);
  }

  protected _setCallContext(context: {
    camera?: string;
    stream?: string;
    state?: CallViewState;
  }): void {
    this._api.getViewManager().setViewByParameters({
      modifiers: [new CallSetViewModifier(context)],
      ignoreNavigationLock: true,
    });
  }

  protected _clearCallContext(): void {
    this._api.getViewManager().setViewByParameters({
      modifiers: [new CallClearViewModifier()],
      ignoreNavigationLock: true,
    });
  }

  protected _clearCallState(): void {
    this._api.getViewManager().setViewByParameters({
      modifiers: [new CallClearStateViewModifier()],
      ignoreNavigationLock: true,
    });
  }

  protected _getMediaLoadedInfo(cameraID?: string): MediaLoadedInfo | null {
    if (cameraID) {
      return (
        this._api.getMediaLoadedInfoManager().get(cameraID) ??
        this._api.getMediaLoadedInfoManager().get()
      );
    }
    return this._api.getMediaLoadedInfoManager().get();
  }

  protected _matchesActiveCamera(cameraID?: string | null): boolean {
    return !cameraID || !this._state.camera || cameraID === this._state.camera;
  }

  protected async _fail(message: string): Promise<false> {
    this._setState({
      ...this._state,
      state: 'error',
      message,
    });
    this._api.getMessageManager().setMessageIfHigherPriority({
      type: 'error',
      icon: 'mdi:phone-off',
      message,
    });
    this._api.getMicrophoneManager().mute();
    this._api.getMicrophoneManager().disconnect();
    await this._getMediaLoadedInfo(this._state.camera)?.mediaPlayerController?.mute();
    this._clearCallContext();
    this.reset();
    return false;
  }

  protected _setState(state: CallSessionState): void {
    this._state = state;
    this._api.getConditionStateManager().setState({
      call: this._state,
    });
    this._api.getCardElementManager().update();
  }
}