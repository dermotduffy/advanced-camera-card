import { html, LitElement, unsafeCSS, type CSSResult, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';

import type { CameraManager } from '../../camera-manager/manager';
import { ThumbnailDetailsOverlayController } from '../../components-lib/thumbnail/details-overlay/controller';
import type { ResolvedThumbnailDetailsStyle } from '../../components-lib/thumbnail/resolve-details-style';
import { THUMBNAIL_SIZE_DEFAULT } from '../../config/schema/common/controls/thumbnails';
import thumbnailDetailsOverlayStyle from '../../scss/thumbnail-details-overlay.scss?inline';
import type { ViewItem } from '../../view/item';

@customElement('advanced-camera-card-thumbnail-details-overlay')
export class AdvancedCameraCardThumbnailDetailsOverlay extends LitElement {
  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public item?: ViewItem;

  @property({ attribute: 'details-style', reflect: true })
  public detailsStyle?: ResolvedThumbnailDetailsStyle;

  @property({ attribute: false })
  public size: number = THUMBNAIL_SIZE_DEFAULT;

  private _controller = new ThumbnailDetailsOverlayController();

  protected willUpdate(): void {
    this._controller.calculate(
      this.cameraManager,
      this.item,
      this.detailsStyle,
      this.size,
    );
    this.setAttribute('tier', this._controller.getTier());
  }

  protected render(): TemplateResult | void {
    const label = this._controller.getLabel();
    const time = this._controller.getTime();
    const rows = this._controller.getRows();
    const severity = this._controller.getSeverity();
    const isLabelInCorner = this._controller.isLabelInCorner();

    if (!label && !time && !rows.length) {
      return;
    }

    // A time reads left to right even where the language around it does not.
    const renderTime = (): TemplateResult =>
      html`<span class="time" dir="ltr"
        >${time?.hoursMinutes}${time?.seconds
          ? html`<span class="seconds">${time.seconds}</span>`
          : ''}</span
      >`;

    return html`
      ${isLabelInCorner && label
        ? html`<span class="corner-label" title=${label}>${label}</span>`
        : ''}
      <div class="details" severity=${ifDefined(severity ?? undefined)}>
        <div class="headline">
          ${!isLabelInCorner && label
            ? html`<span class="label-container"
                >${severity ? html`<span class="dot"></span>` : ''}
                <span class="label" title=${label}>${label}</span></span
              >`
            : ''}
          ${time ? renderTime() : ''}
        </div>
        ${rows.map((row) => html`<div class="row" title=${row}>${row}</div>`)}
      </div>
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
