import { format } from 'date-fns';
import { CSSResult, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { localize } from '../../../localize/localize';
import { formatDateAndTime, getDurationString } from '../../../utils/basic';
import { RecordingViewMedia } from '../../../view/item';
import '../../icon';
import thumbnailDetailsStyle from '../../../scss/thumbnail-details.scss';

@customElement('advanced-camera-card-thumbnail-details-recording')
export class AdvancedCameraCardThumbnailDetailsRecording extends LitElement {
  @property({ attribute: false })
  public media?: RecordingViewMedia;

  @property({ attribute: false })
  public seek?: Date;

  @property({ attribute: false })
  public cameraTitle?: string;

  protected render(): TemplateResult | void {
    if (!this.media) {
      return;
    }
    const rawStartTime = this.media.getStartTime();
    const startTime = rawStartTime ? formatDateAndTime(rawStartTime) : null;

    const rawEndTime = this.media.getEndTime();
    const duration =
      rawStartTime && rawEndTime ? getDurationString(rawStartTime, rawEndTime) : null;
    const inProgress = this.media.inProgress()
      ? localize('recording.in_progress')
      : null;

    const seek = this.seek ? format(this.seek, 'HH:mm:ss') : null;

    const eventCount = this.media.getEventCount();
    return html`
      ${this.cameraTitle
        ? html` <div class="title">
            <span title="${this.cameraTitle}">${this.cameraTitle}</span>
          </div>`
        : ``}
      <div class="details">
        ${startTime
          ? html` <div>
                <advanced-camera-card-icon
                  title=${localize('recording.start')}
                  .icon=${{ icon: 'mdi:calendar-clock-outline' }}
                ></advanced-camera-card-icon>
                <span title="${startTime}">${startTime}</span>
              </div>
              ${duration || inProgress
                ? html` <div>
                    <advanced-camera-card-icon
                      title=${localize('recording.duration')}
                      .icon=${{ icon: 'mdi:clock-outline' }}
                    ></advanced-camera-card-icon>
                    ${duration ? html`<span title="${duration}">${duration}</span>` : ''}
                    ${inProgress
                      ? html`<span title="${inProgress}">${inProgress}</span>`
                      : ''}
                  </div>`
                : ''}`
          : ''}
        ${seek
          ? html` <div>
              <advanced-camera-card-icon
                title=${localize('event.seek')}
                .icon=${{ icon: 'mdi:clock-fast' }}
              ></advanced-camera-card-icon>
              <span title="${seek}">${seek}</span>
            </div>`
          : html``}
        ${eventCount !== null
          ? html`<div>
              <advanced-camera-card-icon
                title=${localize('recording.events')}
                .icon=${{ icon: 'mdi:shield-alert' }}
              ></advanced-camera-card-icon>
              <span title="${eventCount}">${eventCount}</span>
            </div>`
          : ``}
      </div>
    `;
  }

  static get styles(): CSSResult {
    return unsafeCSS(thumbnailDetailsStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-thumbnail-details-recording': AdvancedCameraCardThumbnailDetailsRecording;
  }
}
