import {
  html,
  LitElement,
  unsafeCSS,
  type CSSResultGroup,
  type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { LastFrameImageController } from '../components-lib/last-frame-image-controller.js';
import type { CameraConfig } from '../config/schema/cameras.js';
import type { ImageBaseConfig } from '../config/schema/common/image.js';
import type { HomeAssistant } from '../ha/types.js';
import lastFrameTimeStyle from '../scss/last-frame-time.scss?inline';
import { formatLastFrameTime } from '../utils/last-frame-store.js';
import { resolveImageMode } from './image-updating-player.js';

/**
 * When the last frame an image in mode `last_frame` shows was captured. Drawn
 * by the view next to its zoomer rather than inside the image, so a zoom
 * enlarges only the picture: the time stays the same size, in the corner.
 */
@customElement('advanced-camera-card-last-frame-time')
export class AdvancedCameraCardLastFrameTime extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public cameraID?: string;

  @property({ attribute: false })
  public imageConfig?: ImageBaseConfig;

  @property({ attribute: false })
  public cameraConfig?: CameraConfig;

  private _lastFrameController = new LastFrameImageController(this, {
    getCameraID: () => this.cameraID ?? null,
    getCameraConfig: () => this.cameraConfig ?? null,
    getImageConfig: () =>
      resolveImageMode({
        imageConfig: this.imageConfig,
        cameraConfig: this.cameraConfig,
      }) === 'last_frame'
        ? this.imageConfig ?? null
        : null,
    onChange: () => this.requestUpdate(),
  });

  protected render(): TemplateResult | void {
    if (this.imageConfig?.last_frame?.show_time === false) {
      return;
    }
    const lastFrame = this._lastFrameController.getLastFrame();
    if (!lastFrame) {
      return;
    }
    return html`<div class="last-frame-time">
      ${formatLastFrameTime(lastFrame.capturedAt, this.hass?.locale)}
    </div>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(lastFrameTimeStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-last-frame-time': AdvancedCameraCardLastFrameTime;
  }
}
