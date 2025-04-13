import {
  css,
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ZoomController } from '../components-lib/zoom/zoom-controller.js';
import { setOrRemoveAttribute } from '../utils/basic.js';
import { PartialZoomSettings } from '../components-lib/zoom/types.js';

@customElement('advanced-camera-card-zoomer')
export class AdvancedCameraCardZoomer extends LitElement {
  protected _zoom: ZoomController | null = null;

  @property({ attribute: false })
  public defaultSettings?: PartialZoomSettings;

  @property({ attribute: false })
  public settings?: PartialZoomSettings | null;

  @state()
  protected _zoomed = false;

  protected _zoomHandler = () => (this._zoomed = true);
  protected _unzoomHandler = () => (this._zoomed = false);

  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('advanced-camera-card:zoom:zoomed', this._zoomHandler);
    this.addEventListener('advanced-camera-card:zoom:unzoomed', this._unzoomHandler);

    // Call for an update to activate.
    this.requestUpdate();
  }

  disconnectedCallback(): void {
    this._zoom?.deactivate();
    this.removeEventListener('advanced-camera-card:zoom:zoomed', this._zoomHandler);
    this.removeEventListener('advanced-camera-card:zoom:unzoomed', this._unzoomHandler);
    super.disconnectedCallback();
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('_zoomed')) {
      setOrRemoveAttribute(this, this._zoomed, 'zoomed');
    }

    if (this._zoom) {
      if (changedProps.has('defaultSettings')) {
        this._zoom.setDefaultSettings(this.defaultSettings ?? null);
      }
      // If config is null, make no change to the zoom.
      if (changedProps.has('settings') && this.settings) {
        this._zoom.setSettings(this.settings);
      }
    } else {
      // Ensure that the configuration will be set before activation (vs
      // activating in `connectedCallback`).
      this._zoom = new ZoomController(this, {
        config: this.settings,
        defaultConfig: this.defaultSettings,
      });
      this._zoom.activate();
    }
  }

  protected render(): TemplateResult | void {
    return html` <slot></slot> `;
  }

  static get styles(): CSSResultGroup {
    return css`
      :host {
        width: 100%;
        height: 100%;
        display: block;
        cursor: auto;
      }
      :host([zoomed]) {
        cursor: move;
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-zoomer': AdvancedCameraCardZoomer;
  }
}
