import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import { MediaGridController } from '../components-lib/media-grid-controller.js';
import { ViewDisplayConfig } from '../config/schema/common/display.js';
import mediaGridStyle from '../scss/media-grid.scss';

@customElement('advanced-camera-card-media-grid')
export class AdvancedCameraCardMediaGrid extends LitElement {
  @property({ attribute: false })
  public selected?: string;

  @property({ attribute: false })
  public displayConfig?: ViewDisplayConfig;

  protected _controller: MediaGridController | null = null;
  protected _refSlot: Ref<HTMLSlotElement> = createRef();

  connectedCallback(): void {
    super.connectedCallback();

    // Ensure the controller is recreated.
    this.requestUpdate();
  }

  disconnectedCallback(): void {
    this._controller?.destroy();
    this._controller = null;
    super.disconnectedCallback();
  }

  protected updated(changedProps: PropertyValues): void {
    if (!this._controller && this._refSlot.value) {
      this._controller = new MediaGridController(this._refSlot.value, {
        selected: this.selected,
        displayConfig: this.displayConfig,
      });
    }

    if (changedProps.has('selected')) {
      if (this.selected) {
        this._controller?.selectCell(this.selected);
      } else {
        this._controller?.unselectAll();
      }
    }

    if (changedProps.has('displayConfig')) {
      this._controller?.setDisplayConfig(this.displayConfig ?? null);
    }
  }

  protected render(): TemplateResult | void {
    return html`<slot ${ref(this._refSlot)}></slot> `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(mediaGridStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-media-grid': AdvancedCameraCardMediaGrid;
  }
}
