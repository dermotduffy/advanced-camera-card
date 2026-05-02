import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { guard } from 'lit/directives/guard.js';
import { keyed } from 'lit/directives/keyed.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import { CameraManager } from '../camera-manager/manager';
import { ViewManagerEpoch } from '../card-controller/view/types';
import { ZoomSettingsObserved } from '../components-lib/zoom/types';
import { handleZoomSettingsObservedEvent } from '../components-lib/zoom/zoom-view-context';
import { CameraConfig } from '../config/schema/cameras';
import {
  type EnabledProxyConfig,
  resolveProxyConfig,
} from '../config/schema/common/proxy';
import { ImageViewConfig, type ImageViewProxyConfig } from '../config/schema/image';
import { HomeAssistant } from '../ha/types';
import { localize } from '../localize/localize.js';
import imageStyle from '../scss/image.scss';
import { MediaPlayer, MediaPlayerController, MediaPlayerElement } from '../types.js';
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

    // Determine if this image mode requires a camera
    const mode = resolveImageMode({
      imageConfig: this.imageConfig,
      cameraConfig: this.cameraConfig,
    });

    if (mode === 'camera' && !this.cameraConfig) {
      return renderNotificationBlockFromText(localize('error.no_camera_for_image'), {
        icon: 'mdi:camera-off',
      });
    }

    const view = this.viewManagerEpoch?.manager.getView();
    const mediaEpoch = view?.context?.mediaEpoch?.[IMAGE_VIEW_TARGET_ID_SENTINEL] ?? 0;

    return this._renderContainer(html`
      ${keyed(
        mediaEpoch,
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
