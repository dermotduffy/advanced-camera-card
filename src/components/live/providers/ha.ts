import { HomeAssistant } from '@dermotduffy/custom-card-helpers';
import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { createRef, Ref, ref } from 'lit/directives/ref.js';
import { CameraConfig } from '../../../config/types';
import '../../../patches/ha-camera-stream';
import '../../../patches/ha-hls-player.js';
import '../../../patches/ha-web-rtc-player.js';
import liveHAStyle from '../../../scss/live-ha.scss';
import { FrigateCardMediaPlayer } from '../../../types.js';

@customElement('frigate-card-live-ha')
export class FrigateCardLiveHA extends LitElement implements FrigateCardMediaPlayer {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public cameraConfig?: CameraConfig;

  @property({ attribute: true, type: Boolean })
  public controls = false;

  protected _playerRef: Ref<Element & FrigateCardMediaPlayer> = createRef();

  public async play(): Promise<void> {
    return this._playerRef.value?.play();
  }

  public async pause(): Promise<void> {
    this._playerRef.value?.pause();
  }

  public async mute(): Promise<void> {
    this._playerRef.value?.mute();
  }

  public async unmute(): Promise<void> {
    this._playerRef.value?.unmute();
  }

  public isMuted(): boolean {
    return this._playerRef.value?.isMuted() ?? true;
  }

  public async seek(seconds: number): Promise<void> {
    this._playerRef.value?.seek(seconds);
  }

  public async setControls(controls?: boolean): Promise<void> {
    this._playerRef.value?.setControls(controls ?? this.controls);
  }

  public isPaused(): boolean {
    return this._playerRef.value?.isPaused() ?? true;
  }

  public async getScreenshotURL(): Promise<string | null> {
    return (await this._playerRef.value?.getScreenshotURL()) ?? null;
  }

  protected render(): TemplateResult | void {
    if (!this.hass) {
      return;
    }

    return html` <frigate-card-ha-camera-stream
      ${ref(this._playerRef)}
      .hass=${this.hass}
      .stateObj=${this.cameraConfig?.camera_entity
        ? this.hass.states[this.cameraConfig.camera_entity]
        : undefined}
      .controls=${this.controls}
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
