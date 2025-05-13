import { format } from 'date-fns';
import { CSSResult, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { localize } from '../../../localize/localize';
import thumbnailDetailsStyle from '../../../scss/thumbnail-details.scss';
import {
  formatDateAndTime,
  getDurationString,
  prettifyTitle,
} from '../../../utils/basic';
import { EventViewMedia } from '../../../view/item';
import '../../icon';

@customElement('advanced-camera-card-thumbnail-details-event')
export class AdvancedCameraCardThumbnailDetailsEvent extends LitElement {
  @property({ attribute: false })
  public media?: EventViewMedia;

  @property({ attribute: false })
  public seek?: Date;

  @property({ attribute: false })
  public cameraTitle?: string;

  protected render(): TemplateResult | void {
    if (!this.media) {
      return;
    }
    const title = this.media.getTitle();
    const rawScore = this.media.getScore();
    const score = rawScore ? (rawScore * 100).toFixed(2) + '%' : null;
    const rawStartTime = this.media.getStartTime();
    const startTime = rawStartTime ? formatDateAndTime(rawStartTime) : null;

    const rawEndTime = this.media.getEndTime();
    const duration =
      rawStartTime && rawEndTime ? getDurationString(rawStartTime, rawEndTime) : null;
    const inProgress = this.media.inProgress() ? localize('event.in_progress') : null;

    const what = prettifyTitle(this.media.getWhat()?.join(', ')) ?? null;
    const where = prettifyTitle(this.media.getWhere()?.join(', ')) ?? null;
    const tags = prettifyTitle(this.media.getTags()?.join(', ')) ?? null;
    const whatWithTags =
      what || tags ? (what ?? '') + (what && tags ? ': ' : '') + (tags ?? '') : null;

    const seek = this.seek ? format(this.seek, 'HH:mm:ss') : null;

    return html`
      ${whatWithTags
        ? html` <div class="title">
            <span title=${whatWithTags}>${whatWithTags}</span>
            ${score ? html`<span title="${score}">${score}</span>` : ''}
          </div>`
        : ``}
      ${(!whatWithTags && title) ||
      startTime ||
      this.cameraTitle ||
      where ||
      tags ||
      seek
        ? html` <div class="details">
            ${title
              ? html` <div>
                  <span>${title}</span>
                </div>`
              : ''}
            ${startTime
              ? html` <div>
                    <advanced-camera-card-icon
                      title=${localize('event.start')}
                      .icon=${{ icon: 'mdi:calendar-clock-outline' }}
                    ></advanced-camera-card-icon>
                    <span title="${startTime}">${startTime}</span>
                  </div>
                  ${duration || inProgress
                    ? html` <div>
                        <advanced-camera-card-icon
                          title=${localize('event.duration')}
                          .icon=${{ icon: 'mdi:clock-outline' }}
                        ></advanced-camera-card-icon>
                        ${duration
                          ? html`<span title="${duration}">${duration}</span>`
                          : ''}
                        ${inProgress
                          ? html`<span title="${inProgress}">${inProgress}</span>`
                          : ''}
                      </div>`
                    : ''}`
              : ''}
            ${this.cameraTitle
              ? html` <div>
                  <advanced-camera-card-icon
                    title=${localize('event.camera')}
                    .icon=${{ icon: 'mdi:cctv' }}
                  ></advanced-camera-card-icon>
                  <span title="${this.cameraTitle}">${this.cameraTitle}</span>
                </div>`
              : ''}
            ${where
              ? html` <div>
                  <advanced-camera-card-icon
                    title=${localize('event.where')}
                    .icon=${{ icon: 'mdi:map-marker-outline' }}
                  ></advanced-camera-card-icon>
                  <span title="${where}">${where}</span>
                </div>`
              : html``}
            ${tags
              ? html` <div>
                  <advanced-camera-card-icon
                    title=${localize('event.tag')}
                    .icon=${{ icon: 'mdi:tag' }}
                  ></advanced-camera-card-icon>
                  <span title="${tags}">${tags}</span>
                </div>`
              : html``}
            ${seek
              ? html` <div>
                  <advanced-camera-card-icon
                    title=${localize('event.seek')}
                    .icon=${{ icon: 'mdi:clock-fast' }}
                  ></advanced-camera-card-icon>
                  <span title="${seek}">${seek}</span>
                </div>`
              : html``}
          </div>`
        : ''}
    `;
  }

  static get styles(): CSSResult {
    return unsafeCSS(thumbnailDetailsStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-thumbnail-details-event': AdvancedCameraCardThumbnailDetailsEvent;
  }
}
