import { HomeAssistant } from 'custom-card-helpers';
import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { createRef, Ref, ref } from 'lit/directives/ref.js';
import liveHAStyle from '../../scss/live-ha.scss';
import { CameraConfig, FrigateCardMediaPlayer } from '../../types.js';
import { getStateObjOrDispatchError } from './live.js';
import '../../patches/ha-camera-stream';
import '../../patches/ha-hls-player.js';
import '../../patches/ha-web-rtc-player.ts';

@customElement('frigate-card-live-ha')
export class FrigateCardLiveHA extends LitElement implements FrigateCardMediaPlayer {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public cameraConfig?: CameraConfig;

  protected _playerRef: Ref<Element & FrigateCardMediaPlayer> = createRef();

  public async play(): Promise<void> {
    return this._playerRef.value?.play();
  }

  public pause(): void {
    this._playerRef.value?.pause();
  }

  public mute(): void {
    this._playerRef.value?.mute();
  }

  public unmute(): void {
    this._playerRef.value?.unmute();
  }

  public isMuted(): boolean {
    return this._playerRef.value?.isMuted() ?? true;
  }

  public seek(seconds: number): void {
    this._playerRef.value?.seek(seconds);
  }

  protected render(): TemplateResult | void {
    if (!this.hass) {
      return;
    }

    const stateObj = getStateObjOrDispatchError(this, this.hass, this.cameraConfig);
    if (!stateObj) {
      return;
    }

    return html` <frigate-card-ha-camera-stream
      ${ref(this._playerRef)}
      .hass=${this.hass}
      .stateObj=${stateObj}
      .controls=${true}
      .muted=${true}
    >
    </frigate-card-ha-camera-stream>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(liveHAStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-live-ha': FrigateCardLiveHA;
  }
}
