import { CSSResult, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import thumbnailDetailsStyle from '../../../scss/thumbnail-details.scss';
import { ViewFolder } from '../../../view/item';
import '../../icon';

@customElement('advanced-camera-card-thumbnail-details-folder')
export class AdvancedCameraCardThumbnailDetailsFolder extends LitElement {
  @property({ attribute: false })
  public folder?: ViewFolder;

  protected render(): TemplateResult | void {
    if (!this.folder || !this.folder.getTitle()) {
      return;
    }

    return html`
      <div class="details">
        <div>
          ${this.folder.getIcon() && this.folder.getThumbnail()
            ? html` <advanced-camera-card-icon
                .icon=${{ icon: this.folder.getIcon() }}
              ></advanced-camera-card-icon>`
            : ''}
          <span>${this.folder.getTitle()}</span>
        </div>
      </div>
    `;
  }

  static get styles(): CSSResult {
    return unsafeCSS(thumbnailDetailsStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-thumbnail-details-folder': AdvancedCameraCardThumbnailDetailsFolder;
  }
}
