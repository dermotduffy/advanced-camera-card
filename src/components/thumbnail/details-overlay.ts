import { html, LitElement, unsafeCSS, type CSSResult, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import type { CameraManager } from '../../camera-manager/manager';
import { isMediaReviewed } from '../../components-lib/media/format';
import { ThumbnailDetailsOverlayController } from '../../components-lib/thumbnail/details-overlay/controller';
import type { ResolvedThumbnailStyle } from '../../components-lib/thumbnail/resolve-style';
import { THUMBNAIL_SIZE_DEFAULT } from '../../config/schema/common/controls/thumbnails';
import { localize } from '../../localize/localize';
import thumbnailDetailsOverlayStyle from '../../scss/thumbnail-details-overlay.scss?inline';
import { setOrRemoveAttribute } from '../../utils/basic';
import type { ViewItem } from '../../view/item';

import '../icon.js';

@customElement('advanced-camera-card-thumbnail-details-overlay')
export class AdvancedCameraCardThumbnailDetailsOverlay extends LitElement {
  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public item?: ViewItem;

  @property({ attribute: false })
  public thumbnailStyle?: ResolvedThumbnailStyle;

  @property({ attribute: false })
  public size: number = THUMBNAIL_SIZE_DEFAULT;

  private _controller = new ThumbnailDetailsOverlayController();

  protected willUpdate(): void {
    this._controller.calculate({
      cameraManager: this.cameraManager,
      item: this.item,
      thumbnailStyle: this.thumbnailStyle,
      size: this.size,
    });
    this.setAttribute('tier', this._controller.getTier());
    this.toggleAttribute('hover', this._controller.isHover());
    this.toggleAttribute('one-line', this._controller.isOneLineHeadline());

    const isReviewed = isMediaReviewed(this.item);
    setOrRemoveAttribute(
      this,
      isReviewed !== null,
      'review',
      isReviewed ? 'reviewed' : 'unreviewed',
    );
  }

  protected render(): TemplateResult {
    const cornerLabel = this._controller.getCornerLabel();
    const headlineLabel = this._controller.getHeadlineLabel();
    const time = this._controller.getTime();
    const details = this._controller.getDetails();
    const isInProgress = this._controller.isInProgress();

    // A time reads left to right even where the language around it does not.
    const renderTime = (): TemplateResult =>
      html`<span class="time" dir="ltr" title=${time?.hoursMinutesSeconds ?? ''}
        >${time?.hoursMinutes}${time?.seconds
          ? html`<span class="seconds">${time.seconds}</span>`
          : ''}</span
      >`;

    return html`
      ${cornerLabel
        ? html`<span class="corner-label" title=${cornerLabel}>${cornerLabel}</span>`
        : ''}
      ${headlineLabel || time || details.length || isInProgress
        ? html`<div class="details">
            <div class="headline">
              ${isInProgress
                ? html`<span class="in-progress" title=${localize('common.in_progress')}
                    ><span class="dot"></span
                    ><span class="label"
                      >${localize('thumbnail.in_progress')}</span
                    ></span
                  >`
                : ''}
              ${headlineLabel
                ? html`<span class="label" title=${headlineLabel}
                    >${headlineLabel}</span
                  >`
                : ''}
              ${time ? renderTime() : ''}
            </div>
            ${details.map(
              (detail) => html`<div class="detail" title=${detail}>${detail}</div>`,
            )}
          </div>`
        : ''}
    `;
  }

  static get styles(): CSSResult {
    return unsafeCSS(thumbnailDetailsOverlayStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-thumbnail-details-overlay': AdvancedCameraCardThumbnailDetailsOverlay;
  }
}
