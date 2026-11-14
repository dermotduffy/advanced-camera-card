import {
  css,
  html,
  LitElement,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import type { PartialZoomSettings } from '../components-lib/zoom/types.js';
import { ZoomController } from '../components-lib/zoom/zoom-controller.js';
import type { CameraDimensionsConfig } from '../config/schema/cameras.js';
import type { MediaLoadedInfoEventDetail } from '../types.js';
import { onAbort } from '../utils/abort-signal.js';
import { isValidAspectRatio } from '../utils/basic.js';

// Whether the media is drawn with `object-fit: contain`, centered, at its own
// aspect ratio inside the zoomer. Only then does the zoomer know where the
// picture is, and limit the pan to it rather than to the zoomer.
const isContainedAndCentered = (dimensions?: CameraDimensionsConfig): boolean => {
  const layout = dimensions?.layout;
  return (
    !isValidAspectRatio(dimensions?.aspect_ratio) &&
    !dimensions?.rotation &&
    (layout?.fit ?? 'contain') === 'contain' &&
    (layout?.position?.x ?? 50) === 50 &&
    (layout?.position?.y ?? 50) === 50 &&
    !Object.values(layout?.view_box ?? {}).some((edge) => !!edge)
  );
};

@customElement('advanced-camera-card-zoomer')
export class AdvancedCameraCardZoomer extends LitElement {
  @property({ attribute: false })
  public defaultSettings?: PartialZoomSettings;

  @property({ attribute: false })
  public settings?: PartialZoomSettings | null;

  @property({ attribute: false })
  public zoom = true;

  // The same dimensions the media is laid out with.
  @property({ attribute: false })
  public dimensionsConfig?: CameraDimensionsConfig;

  @state()
  private _zoomed = false;

  private _zoomController = new ZoomController(this);

  // The aspect ratio of the loaded media, and the signal that retires it.
  private _mediaAspectRatio: number | null = null;
  private _mediaSignal: AbortSignal | null = null;

  private _mediaLoadedHandler = (ev: CustomEvent<MediaLoadedInfoEventDetail>): void => {
    const { info, signal } = ev.detail;
    this._mediaAspectRatio = info.width && info.height ? info.width / info.height : null;
    this._mediaSignal = signal;
    onAbort(signal, () => {
      // A later load may already have replaced this one.
      if (this._mediaSignal === signal) {
        this._mediaAspectRatio = null;
        this._mediaSignal = null;
        this._setPictureAspectRatio();
      }
    });
    this._setPictureAspectRatio();
  };

  private _zoomHandler = () => (this._zoomed = true);
  private _unzoomHandler = () => (this._zoomed = false);

  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('advanced-camera-card:zoom:zoomed', this._zoomHandler);
    this.addEventListener('advanced-camera-card:zoom:unzoomed', this._unzoomHandler);
    this.addEventListener('advanced-camera-card:media:loaded', this._mediaLoadedHandler);

    // Call for an update to activate.
    this.requestUpdate();
  }

  disconnectedCallback(): void {
    this._zoomController.deactivate();
    this.removeEventListener('advanced-camera-card:zoom:zoomed', this._zoomHandler);
    this.removeEventListener('advanced-camera-card:zoom:unzoomed', this._unzoomHandler);
    this.removeEventListener(
      'advanced-camera-card:media:loaded',
      this._mediaLoadedHandler,
    );
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
      this._setPictureAspectRatio();
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

  private _setPictureAspectRatio(): void {
    this._zoomController.setPictureAspectRatio(
      isContainedAndCentered(this.dimensionsConfig) ? this._mediaAspectRatio : null,
    );
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
