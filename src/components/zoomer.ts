import {
  css,
  html,
  LitElement,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import type {
  PartialZoomSettings,
  ZoomSettingsObserved,
} from '../components-lib/zoom/types.js';
import { ZoomController } from '../components-lib/zoom/zoom-controller.js';
import type { CameraDimensionsConfig } from '../config/schema/cameras.js';

@customElement('advanced-camera-card-zoomer')
export class AdvancedCameraCardZoomer extends LitElement {
  @property({ attribute: false })
  public defaultSettings?: PartialZoomSettings;

  @property({ attribute: false })
  public settings?: PartialZoomSettings | null;

  // Gets the zoom the target was last seen at (the view context's `observed`).
  // A remount (a stream reload, the card shown again, a lazily unloaded camera
  // loaded again) starts from it rather than from the default. A getter, read
  // only on activation, so that every zoom report does not render this again.
  @property({ attribute: false })
  public getObservedSettings?: () => ZoomSettingsObserved | null;

  // The key the target's zoom is kept under in the page-wide zoom store, so a
  // card built again (e.g. on a return from another dashboard) starts from it.
  @property({ attribute: false })
  public storeKey?: string | null;

  @property({ attribute: false })
  public zoom = true;

  // The dimensions the media inside is laid out with.
  @property({ attribute: false })
  public dimensionsConfig?: CameraDimensionsConfig;

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
      this.toggleAttribute('zoomed', this._zoomed);
    }

    if (changedProps.has('zoom')) {
      this._zoomController.setZoom(this.zoom);
    }
    if (changedProps.has('dimensionsConfig')) {
      this._zoomController.setDimensionsConfig(this.dimensionsConfig ?? null);
    }
    if (changedProps.has('storeKey')) {
      this._zoomController.setStoreKey(this.storeKey ?? null);
    }
    if (changedProps.has('defaultSettings')) {
      this._zoomController.setDefaultSettings(this.defaultSettings ?? null);
    }
    // If config is null, make no change to the zoom.
    if (changedProps.has('settings') && this.settings) {
      this._zoomController.setSettings(this.settings);
    }

    if (!this._zoomController.isActivated()) {
      // A request still pending at a remount (also an empty one, e.g. the
      // double tap just before a stream reload) wins over where the target was.
      this._zoomController.setStartSettings(
        this.getObservedSettings?.() ?? null,
        !!this.settings,
      );
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
