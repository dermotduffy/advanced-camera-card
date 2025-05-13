import { CSSResult, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { HomeAssistant } from '../../../ha/types';
import thumbnailFeatureThumbnailStyle from '../../../scss/thumbnail-feature-folder.scss';
import {
  brandsUrl,
  extractDomainFromBrandUrl,
  isBrandUrl,
} from '../../../ha/brands-url';
import { ViewFolder } from '../../../view/item';
import './thumbnail.js';

@customElement('advanced-camera-card-thumbnail-feature-folder')
export class AdvancedCameraCardThumbnailFeatureFolder extends LitElement {
  @property({ attribute: false })
  public folder?: ViewFolder;

  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public showName = true;

  protected render(): TemplateResult | void {
    const thumbnail = this.folder?.getThumbnail();
    const title = this.folder?.getTitle() ?? '';

    if (thumbnail) {
      const _thumbnail = isBrandUrl(thumbnail)
        ? brandsUrl({
            domain: extractDomainFromBrandUrl(thumbnail),
            type: 'icon',
            useFallback: true,
          })
        : thumbnail;

      return html`<advanced-camera-card-thumbnail-feature-thumbnail
          class="brand"
          aria-label="${title ?? ''}"
          title=${title}
          .hass=${this.hass}
          .thumbnail=${_thumbnail}
        ></advanced-camera-card-thumbnail-feature-thumbnail>
        ${title && this.showName ? html`<div>${title}</div>` : ''}`;
    }

    const icon = this.folder?.getIcon() ?? 'mdi:image-off';
    return html`<advanced-camera-card-icon .icon=${{ icon }}>
      </advanced-camera-card-icon>
      ${title && this.showName ? html`<div>${title}</div>` : ''}`;
  }

  static get styles(): CSSResult {
    return unsafeCSS(thumbnailFeatureThumbnailStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-thumbnail-feature-folder': AdvancedCameraCardThumbnailFeatureFolder;
  }
}
