// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

// ====================================================================
// ** Keep modifications to this file to a minimum **
//
// Type checking is disabled since this is a modified copy-and-paste of
// underlying render() function, but the rest of the class source it not
// available as compilation time.
// ====================================================================

import { css, CSSResultGroup, html, unsafeCSS, TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { query } from 'lit/decorators/query.js';
import { FrigateCardMediaPlayer } from '../types.js';
import { dispatchMediaLoadedEvent } from '../utils/media-info.js';
import './ha-hls-player';
import './ha-web-rtc-player';
import liveHAComponentsStyle from '../scss/live-ha-components.scss';

customElements.whenDefined('ha-camera-stream').then(() => {
  // ========================================================================================
  // From:
  // - https://github.com/home-assistant/frontend/blob/dev/src/data/camera.ts
  // - https://github.com/home-assistant/frontend/blob/dev/src/common/entity/compute_state_name.ts
  // - https://github.com/home-assistant/frontend/blob/dev/src/common/entity/compute_object_id.ts
  // ========================================================================================
  const computeMJPEGStreamUrl = (entity: CameraEntity): string =>
    `/api/camera_proxy_stream/${entity.entity_id}?token=${entity.attributes.access_token}`;

  const computeObjectId = (entityId: string): string =>
    entityId.substr(entityId.indexOf('.') + 1);

  const computeStateName = (stateObj: HassEntity): string =>
    stateObj.attributes.friendly_name === undefined
      ? computeObjectId(stateObj.entity_id).replace(/_/g, ' ')
      : stateObj.attributes.friendly_name || '';

  const STREAM_TYPE_HLS = 'hls';
  const STREAM_TYPE_WEB_RTC = 'web_rtc';

  @customElement('frigate-card-ha-camera-stream')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  class FrigateCardHaCameraStream
    extends customElements.get('ha-camera-stream')
    implements FrigateCardMediaPlayer
  {
    // Due to an obscure behavior when this card is casted, this element needs
    // to use query rather than the ref directive to find the player.
    @query('#player')
    protected _player: FrigateCardMediaPlayer;

    // ========================================================================================
    // Minor modifications from:
    // - https://github.com/home-assistant/frontend/blob/dev/src/components/ha-camera-stream.ts
    // ========================================================================================

    public async play(): Promise<void> {
      return this._player?.play();
    }

    public pause(): void {
      this._player?.pause();
    }

    public mute(): void {
      this._player?.mute();
    }

    public unmute(): void {
      this._player?.unmute();
    }

    public isMuted(): boolean {
      return this._player?.isMuted() ?? true;
    }

    /**
     * Seek the video (unsupported).
     */
    public seek(seconds: number): void {
      this._player?.seek(seconds);
    }

    /**
     * Master render method.
     * @returns A rendered template.
     */
    protected render(): TemplateResult {
      if (!this.stateObj) {
        return html``;
      }

      if (this._shouldRenderMJPEG) {
        return html`
          <img
            @load=${(ev: Event) => {
              dispatchMediaLoadedEvent(this, ev);
            }}
            .src=${typeof this._connected == 'undefined' || this._connected
              ? computeMJPEGStreamUrl(this.stateObj)
              : ''}
            .alt=${`Preview of the ${computeStateName(this.stateObj)} camera.`}
          />
        `;
      }
      if (this.stateObj.attributes.frontend_stream_type === STREAM_TYPE_HLS) {
        return this._url
          ? html` <frigate-card-ha-hls-player
              id="player"
              ?autoplay=${false}
              playsinline
              .allowExoPlayer=${this.allowExoPlayer}
              .muted=${this.muted}
              .controls=${this.controls}
              .hass=${this.hass}
              .url=${this._url}
            ></frigate-card-ha-hls-player>`
          : html``;
      }
      if (this.stateObj.attributes.frontend_stream_type === STREAM_TYPE_WEB_RTC) {
        return html`<frigate-card-ha-web-rtc-player
          id="player"
          ?autoplay=${false}
          playsinline
          .muted=${this.muted}
          .controls=${this.controls}
          .hass=${this.hass}
          .entityid=${this.stateObj.entity_id}
        ></frigate-card-ha-web-rtc-player>`;
      }
    }

    static get styles(): CSSResultGroup {
      return [
        super.styles,
        unsafeCSS(liveHAComponentsStyle),
        css`
          :host {
            width: 100%;
            height: 100%;
          }
          img {
            width: 100%;
            height: 100%;
          }
        `,
      ];
    }
  }
});

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-ha-camera-stream': FrigateCardHaCameraStream;
  }
}
