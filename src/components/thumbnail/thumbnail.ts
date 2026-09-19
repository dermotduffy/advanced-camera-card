import {
  html,
  LitElement,
  unsafeCSS,
  type CSSResult,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';

import type { CameraManager } from '../../camera-manager/manager.js';
import type { FoldersManager } from '../../card-controller/folders/manager.js';
import type { ViewItemManager } from '../../card-controller/view/item-manager.js';
import type { ViewManagerEpoch } from '../../card-controller/view/types.js';
import { getMediaSeverity } from '../../components-lib/media/format.js';
import type { ResolvedThumbnailDetailsStyle } from '../../components-lib/thumbnail/resolve-details-style.js';
import { THUMBNAIL_SIZE_DEFAULT } from '../../config/schema/common/controls/thumbnails.js';
import type { HomeAssistant } from '../../ha/types.js';
import thumbnailStyle from '../../scss/thumbnail.scss?inline';
import { setOrRemoveAttribute } from '../../utils/basic.js';
import { ViewItemClassifier } from '../../view/item-classifier.js';
import type { ViewItem } from '../../view/item.js';

import './details-overlay.js';
import './details-panel.js';
import './feature/feature.js';
import './feature/thumbnail.js';

@customElement('advanced-camera-card-thumbnail')
export class AdvancedCameraCardThumbnail extends LitElement {
  // Performance: During timeline scrubbing, hass may be updated continuously.
  // As it is not needed for the thumbnail rendering itself, it does not trigger
  // a re-render. The HomeAssistant object may be required for thumbnail signing
  // (after initial signing the thumbnail is stored in a data URL, so the
  // signing will not expire).
  public hass?: HomeAssistant;

  // Performance: During timeline scrubbing, the view will be updated
  // continuously. As it is not needed for the thumbnail rendering itself, it
  // does not trigger a re-render.
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public viewItemManager?: ViewItemManager;

  @property({ attribute: false })
  public folderManager?: FoldersManager;

  @property({ attribute: false })
  public item?: ViewItem;

  @property({ attribute: 'details-style', reflect: true })
  public detailsStyle?: ResolvedThumbnailDetailsStyle;

  @property({ attribute: false })
  public size: number = THUMBNAIL_SIZE_DEFAULT;

  @property({ attribute: true, type: Boolean })
  public show_favorite_control = false;

  @property({ attribute: true, type: Boolean })
  public show_timeline_control = false;

  @property({ attribute: true, type: Boolean })
  public show_download_control = false;

  @property({ attribute: true, type: Boolean })
  public show_review_control = false;

  @property({ attribute: true, type: Boolean })
  public show_info_control = false;

  @property({ attribute: false })
  public filterReviewed?: boolean;

  @property({ attribute: false })
  public filterFavorite?: boolean;

  @property({ attribute: false })
  public seek?: Date;

  @property({ attribute: true, type: Boolean })
  public clickable = false;

  @property({ attribute: true, type: Boolean, reflect: true })
  public selected = false;

  constructor() {
    super();
    this.addEventListener('keydown', (ev: KeyboardEvent) => this._keydown(ev));
  }

  private _keydown(ev: KeyboardEvent): void {
    if (this.clickable && (ev.key === 'Enter' || ev.key === ' ')) {
      // Space would otherwise scroll the page.
      ev.preventDefault();
      this.click();
    }
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has('clickable') || changedProperties.has('item')) {
      if (this.clickable) {
        this.setAttribute('tabindex', '0');
        this.setAttribute('role', 'button');
        this.setAttribute('aria-label', this.item?.getTitle() ?? '');
      } else {
        this.removeAttribute('tabindex');
        this.removeAttribute('role');
        this.removeAttribute('aria-label');
      }
    }

    if (changedProperties.has('item')) {
      const severity = getMediaSeverity(this.item);
      setOrRemoveAttribute(this, !!severity, 'severity', severity);

      this.toggleAttribute(
        'favorite',
        ViewItemClassifier.isMedia(this.item) && this.item.isFavorite() === true,
      );
    }
  }

  /**
   * Render the element.
   * @returns A template to display to the user.
   */
  protected render(): TemplateResult | void {
    if (!this.item) {
      return;
    }

    return html`
      <advanced-camera-card-thumbnail-feature
        .cameraManager=${this.cameraManager}
        .detailsStyle=${this.detailsStyle}
        .hass=${this.hass}
        .item=${this.item}
        .size=${this.size}
        .viewItemManager=${this.viewItemManager}
        .viewManagerEpoch=${this.viewManagerEpoch}
        .show_favorite_control=${this.show_favorite_control}
        .show_timeline_control=${this.show_timeline_control}
        .show_download_control=${this.show_download_control}
        .show_review_control=${this.show_review_control}
        .show_info_control=${this.show_info_control}
        .filterReviewed=${this.filterReviewed}
        .filterFavorite=${this.filterFavorite}
      >
      </advanced-camera-card-thumbnail-feature>
      ${this.detailsStyle === 'overlay' || this.detailsStyle === 'hover'
        ? html`<advanced-camera-card-thumbnail-details-overlay
            .cameraManager=${this.cameraManager}
            .item=${this.item}
            .detailsStyle=${this.detailsStyle}
            .size=${this.size}
          ></advanced-camera-card-thumbnail-details-overlay>`
        : ''}
      ${this.detailsStyle === 'panel'
        ? html`<advanced-camera-card-thumbnail-details-panel
            .hass=${this.hass}
            .item=${this.item ?? undefined}
            .cameraManager=${this.cameraManager}
            .seek=${this.seek}
            .viewItemManager=${this.viewItemManager}
            .viewManagerEpoch=${this.viewManagerEpoch}
            .filterReviewed=${this.filterReviewed}
            .filterFavorite=${this.filterFavorite}
            .size=${this.size}
          ></advanced-camera-card-thumbnail-details-panel>`
        : ''}
      ${this.selected ? html`<div class="selection"></div>` : ''}
    `;
  }

  static get styles(): CSSResult {
    return unsafeCSS(thumbnailStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-thumbnail': AdvancedCameraCardThumbnail;
  }
}
