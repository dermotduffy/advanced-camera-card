import {
  html,
  LitElement,
  unsafeCSS,
  type CSSResult,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';

import type { CameraManager } from '../../camera-manager/manager';
import type { ViewItemManager } from '../../card-controller/view/item-manager';
import type { ViewManagerEpoch } from '../../card-controller/view/types';
import type { MediaDetail } from '../../components-lib/media/detail';
import { ThumbnailDetailsPanelController } from '../../components-lib/thumbnail/details-panel/controller';
import type { HomeAssistant } from '../../ha/types';
import { localize } from '../../localize/localize';
import thumbnailDetailsPanelStyle from '../../scss/thumbnail-details-panel.scss?inline';
import { stopEventFromActivatingCardWideActions } from '../../utils/action';
import { showMediaInfoNotification } from '../../utils/media-actions';
import type { ViewItem } from '../../view/item';

import '../icon';

@customElement('advanced-camera-card-thumbnail-details-panel')
export class AdvancedCameraCardThumbnailDetailsPanel extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public item?: ViewItem;

  @property({ attribute: false })
  public seek?: Date;

  @property({ attribute: false })
  public viewItemManager?: ViewItemManager;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public filterReviewed?: boolean;

  @property({ attribute: false })
  public size?: number;

  @property({ attribute: false })
  public showInfoControl = false;

  private _controller = new ThumbnailDetailsPanelController();

  protected willUpdate(changedProperties: PropertyValues): void {
    if (
      ['item', 'seek', 'cameraManager', 'size', 'showInfoControl'].some((prop) =>
        changedProperties.has(prop),
      )
    ) {
      this._controller.calculate(
        this.cameraManager,
        this.item,
        this.seek,
        this.size,
        this.showInfoControl,
      );
      this.setAttribute('tier', this._controller.getTier());
    }
  }

  private _showInfo(ev: Event): void {
    stopEventFromActivatingCardWideActions(ev);
    if (!this.item) {
      return;
    }

    showMediaInfoNotification(
      this,
      this.item,
      {
        hass: this.hass,
        viewItemManager: this.viewItemManager,
        viewManagerEpoch: this.viewManagerEpoch,
        capabilities: this.viewItemManager?.getCapabilities(this.item),
        filterReviewed: this.filterReviewed,
      },
      this.cameraManager,
    );
  }

  protected render(): TemplateResult | void {
    const heading = this._controller.getHeading();
    const rows = this._controller.getRows();
    const hiddenRowCount = this._controller.getHiddenRowCount();

    const renderDetail = (detail: MediaDetail, heading = false): TemplateResult => {
      return html`<div
        class=${classMap({
          heading,
        })}
      >
        ${detail.icon
          ? html` <advanced-camera-card-icon
              severity=${ifDefined(detail.severity)}
              title=${detail.tooltip ?? ''}
              .icon=${{ icon: detail.icon }}
            ></advanced-camera-card-icon>`
          : ''}
        <span title=${detail.text}>${detail.text}</span>
      </div>`;
    };

    return html`
      ${heading ? renderDetail(heading, true) : ``}
      ${rows.map((row) => renderDetail(row))}
      ${hiddenRowCount
        ? html`<ha-assist-chip
            class="more"
            filled
            .label=${localize(
              'thumbnail.more_details',
              '{count}',
              String(hiddenRowCount),
            )}
            @click=${(ev: Event) => this._showInfo(ev)}
          ></ha-assist-chip>`
        : ''}
    `;
  }

  static get styles(): CSSResult {
    return unsafeCSS(thumbnailDetailsPanelStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-thumbnail-details-panel': AdvancedCameraCardThumbnailDetailsPanel;
  }
}
