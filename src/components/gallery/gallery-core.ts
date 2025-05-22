import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import {
  GalleryColumnCountRoundMethod,
  GalleryCoreController,
} from '../../components-lib/gallery/gallery-core-controller.js';
import { THUMBNAIL_WIDTH_DEFAULT } from '../../config/schema/common/controls/thumbnails.js';
import { CardWideConfig } from '../../config/schema/types.js';
import { HomeAssistant } from '../../ha/types.js';
import galleryCoreStyle from '../../scss/gallery-core.scss';
import '../message.js';
import '../progress-indicator.js';
import { renderProgressIndicator } from '../progress-indicator.js';

@customElement('advanced-camera-card-gallery-core')
export class AdvancedCameraCardGalleryCore extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public columnWidth: number = THUMBNAIL_WIDTH_DEFAULT;

  @property({ attribute: false })
  public columnCountRoundMethod?: GalleryColumnCountRoundMethod;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  @property({ attribute: false })
  public extendUp = false;

  @property({ attribute: false })
  public extendDown = false;

  private _refSentinelBottom: Ref<HTMLElement> = createRef();
  private _refSlot: Ref<HTMLSlotElement> = createRef();

  private _controller = new GalleryCoreController(
    this,
    () => this._refSlot.value ?? null,
    () => this._refSentinelBottom.value ?? null,
    (show) => {
      this._showLoaderTop = show;
    },
    (show) => {
      this._showSentinelBottom = show;
    },
  );

  // Top loader: A progress indicator is shown across the top of the gallery if
  // the user is _already_ at the top of the gallery and scrolls upwards. This
  // attempts to fetch new content from "later" (more recently) than the current
  // query. This is hidden by default.
  @state()
  private _showLoaderTop = false;

  // Bottom sentinel: A progress indicator shown in a "cell" (not across) at the
  // bottom of the gallery. Once visible an attempt is optionally made to extend
  // the gallery downwards. This is rendered by default (so intersection can be
  // detected), and hidden during fetches.
  @state()
  private _showSentinelBottom = true;

  protected willUpdate(changedProps: PropertyValues): void {
    if (
      ['columnCountRoundMethod', 'columnWidth', 'extendUp', 'extendDown'].some((prop) =>
        changedProps.has(prop),
      )
    ) {
      this._controller.setOptions({
        extendUp: this.extendUp,
        extendDown: this.extendDown,
        columnWidth: this.columnWidth,
        columnCountRoundMethod: this.columnCountRoundMethod,
      });
    }
  }

  protected render(): TemplateResult | void {
    return html` <div class="grid">
      ${this.extendUp && this._showLoaderTop
        ? html`${renderProgressIndicator({
            cardWideConfig: this.cardWideConfig,
            classes: {
              top: true,
            },
            size: 'small',
          })}`
        : ''}
      <slot ${ref(this._refSlot)} @slotchange=${() => this._controller.updateContents()}>
      </slot>
      ${this.extendDown && this._showSentinelBottom
        ? html`${renderProgressIndicator({
            cardWideConfig: this.cardWideConfig,
            componentRef: this._refSentinelBottom,
            size: 'small',
          })}`
        : ''}
    </div>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(galleryCoreStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-gallery-core': AdvancedCameraCardGalleryCore;
  }
}
