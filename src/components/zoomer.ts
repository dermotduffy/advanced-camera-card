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
  @property({ attribute: false })
  public defaultSettings?: PartialZoomSettings;

  @property({ attribute: false })
  public settings?: PartialZoomSettings | null;

  @property({ attribute: false })
  public zoom = true;

  @state()
  private _zoomed = false;

  private _zoomController = new ZoomController(this);

  private _zoomHandler = () => (this._zoomed = true);
  private _unzoomHandler = () => (this._zoomed = false);

  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('advanced-camera-card:zoom:zoomed', this._zoomHandler);
    this.addEventListener('advanced-camera-card:zoom:unzoomed', this._unzoomHandler);

    // Call for an update to activate.
    this.requestUpdate();
  }

  disconnectedCallback(): void {
    this._zoomController.deactivate();
    this.removeEventListener('advanced-camera-card:zoom:zoomed', this._zoomHandler);
    this.removeEventListener('advanced-camera-card:zoom:unzoomed', this._unzoomHandler);
    super.disconnectedCallback();
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('_zoomed')) {
      setOrRemoveAttribute(this, this._zoomed, 'zoomed');
    }

    if (changedProps.has('zoom')) {
      this._zoomController.setZoom(this.zoom);
    }
    if (changedProps.has('defaultSettings')) {
      this._zoomController.setDefaultSettings(this.defaultSettings ?? null);
    }
    // If config is null, make no change to the zoom.
    if (changedProps.has('settings') && this.settings) {
      this._zoomController.setSettings(this.settings);
    }

    if (!this._zoomController.isActivated()) {
      this._zoomController.activate();
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
