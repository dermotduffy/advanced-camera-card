import {
  html,
  LitElement,
  unsafeCSS,
  type CSSResultGroup,
  type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { guard } from 'lit/directives/guard.js';
import { keyed } from 'lit/directives/keyed.js';
import { createRef, ref, type Ref } from 'lit/directives/ref.js';

import type { CameraManager } from '../camera-manager/manager';
import type { MediaUnavailableIssueReason } from '../card-controller/issues/issues/media-unavailable';
import type { ViewManagerEpoch } from '../card-controller/view/types';
import { MediaLoadWatchdogController } from '../components-lib/media-load-watchdog-controller';
import { triggerMediaUnavailableIssue } from '../components-lib/media-unavailable-issue';
import type { ZoomSettingsObserved } from '../components-lib/zoom/types';
import { handleZoomSettingsObservedEvent } from '../components-lib/zoom/zoom-view-context';
import type { CameraConfig } from '../config/schema/cameras';
import {
  resolveProxyConfig,
  type EnabledProxyConfig,
} from '../config/schema/common/proxy';
import { type ImageViewConfig, type ImageViewProxyConfig } from '../config/schema/image';
import type { HomeAssistant } from '../ha/types';
import { localize } from '../localize/localize.js';
import imageStyle from '../scss/image.scss?inline';
import type {
  MediaPlayer,
  MediaPlayerController,
  MediaPlayerElement,
} from '../types.js';
import { IMAGE_VIEW_TARGET_ID_SENTINEL } from '../view/target-id.js';

import './image-updating-player';

import { resolveImageMode } from './image-updating-player';

import './media-dimensions-container';

import { renderNotificationBlockFromText } from './notification/block.js';

import './zoomer.js';

@customElement('advanced-camera-card-image')
export class AdvancedCameraCardImage extends LitElement implements MediaPlayer {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public cameraConfig?: CameraConfig;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public imageConfig?: ImageViewConfig;

  private _refImage: Ref<MediaPlayerElement> = createRef();

  constructor() {
    super();

    // No lazy loading: Reports the image as a media_unavailable issue if it
    // never arrives.
    new MediaLoadWatchdogController(this, {
      getTargetID: () => IMAGE_VIEW_TARGET_ID_SENTINEL,
      isLoadExpected: () =>
        // A misconfigured image already shows why nothing can be drawn, and
        // reloading it cannot change the configuration.
        !!this.hass && !this._getConfigurationError(),

      // Player is keyed on epoch.
      getAttemptID: () => this._getMediaEpoch(),
    });
  }

  private _getMediaEpoch(): number {
    const view = this.viewManagerEpoch?.manager.getView();
    return view?.context?.mediaEpoch?.[IMAGE_VIEW_TARGET_ID_SENTINEL] ?? 0;
  }

  // Returns the reason no image can be shown at all, or null when one can.
  // `camera` mode has nothing to draw from without a camera.
  private _getConfigurationError(): string | null {
    const mode = resolveImageMode({
      imageConfig: this.imageConfig,
      cameraConfig: this.cameraConfig,
    });
    return mode === 'camera' && !this.cameraConfig
      ? localize('error.no_camera_for_image')
      : null;
  }

  public async getMediaPlayerController(): Promise<MediaPlayerController | null> {
    await this.updateComplete;
    return (await this._refImage.value?.getMediaPlayerController()) ?? null;
  }

  private _renderContainer(template: TemplateResult): TemplateResult {
    const zoomTarget = IMAGE_VIEW_TARGET_ID_SENTINEL;
    const view = this.viewManagerEpoch?.manager.getView();
    const mode = resolveImageMode({
      imageConfig: this.imageConfig,
      cameraConfig: this.cameraConfig,
    });

    const intermediateTemplate = html` <advanced-camera-card-media-dimensions-container
      .dimensionsConfig=${mode === 'camera' ? this.cameraConfig?.dimensions : undefined}
    >
      ${template}
    </advanced-camera-card-media-dimensions-container>`;

    return html` ${this.imageConfig?.zoomable
      ? html`<advanced-camera-card-zoomer
          .defaultSettings=${guard(
            [this.imageConfig, this.cameraConfig?.dimensions?.layout],
            () =>
              mode === 'camera' && this.cameraConfig?.dimensions?.layout
                ? {
                    pan: this.cameraConfig.dimensions.layout.pan,
                    zoom: this.cameraConfig.dimensions.layout.zoom,
                  }
                : undefined,
          )}
          .settings=${view?.context?.zoom?.[zoomTarget]?.requested}
          @advanced-camera-card:zoom:change=${(ev: CustomEvent<ZoomSettingsObserved>) =>
            handleZoomSettingsObservedEvent(
              ev,
              this.viewManagerEpoch?.manager,
              zoomTarget,
            )}
        >
          ${intermediateTemplate}
        </advanced-camera-card-zoomer>`
      : intermediateTemplate}`;
  }

  private _resolveProxyConfig(proxy?: ImageViewProxyConfig): EnabledProxyConfig | null {
    return proxy
      ? {
          ...resolveProxyConfig(proxy),
          enabled: proxy.enabled,
          enforce: proxy.enabled,
        }
      : null;
  }

  protected render(): TemplateResult | void {
    if (!this.hass) {
      return;
    }

    const configurationError = this._getConfigurationError();
    if (configurationError) {
      return renderNotificationBlockFromText(configurationError, {
        icon: 'mdi:camera-off',
      });
    }

    const view = this.viewManagerEpoch?.manager.getView();

    return this._renderContainer(html`
      ${keyed(
        this._getMediaEpoch(),
        html`
          <advanced-camera-card-image-updating-player
            ${ref(this._refImage)}
            .hass=${this.hass}
            .view=${view}
            .imageConfig=${this.imageConfig}
            .cameraConfig=${this.cameraConfig}
            .targetID=${IMAGE_VIEW_TARGET_ID_SENTINEL}
            .proxyConfig=${this._resolveProxyConfig(this.imageConfig?.proxy) ??
            undefined}
            @advanced-camera-card:image-updating-player:error=${(
              ev: CustomEvent<MediaUnavailableIssueReason>,
            ) =>
              // The image view has no liveness detector, so the view triggers
              // the issue itself. An image's failures are all failures to load.
              // The load watchdog above resolves them once media eventually
              // loads.
              triggerMediaUnavailableIssue(this, {
                targetID: IMAGE_VIEW_TARGET_ID_SENTINEL,
                reason: ev.detail,
              })}
          >
          </advanced-camera-card-image-updating-player>
        `,
      )}
    `);
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(imageStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-image': AdvancedCameraCardImage;
  }
}
