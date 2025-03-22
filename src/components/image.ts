import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { guard } from 'lit/directives/guard.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import { CameraManager } from '../camera-manager/manager';
import { ViewManagerEpoch } from '../card-controller/view/types';
import { ZoomSettingsObserved } from '../components-lib/zoom/types';
import { handleZoomSettingsObservedEvent } from '../components-lib/zoom/zoom-view-context';
import { CameraConfig } from '../config/schema/cameras';
import { ImageViewConfig } from '../config/schema/image';
import { IMAGE_VIEW_ZOOM_TARGET_SENTINEL } from '../const';
import { HomeAssistant } from '../ha/types';
import imageStyle from '../scss/image.scss';
import { MediaPlayer, MediaPlayerController, MediaPlayerElement } from '../types.js';
import { aspectRatioToString } from '../utils/basic';
import { updateElementStyleFromMediaLayoutConfig } from '../utils/media-layout.js';
import './image-updating-player';
import { resolveImageMode } from './image-updating-player';
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

  public async getMediaPlayerController(): Promise<MediaPlayerController | null> {
    await this.updateComplete;
    return (await this._refImage.value?.getMediaPlayerController()) ?? null;
  }

  protected _refImage: Ref<MediaPlayerElement> = createRef();

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('cameraConfig') || changedProps.has('imageConfig')) {
      if (
        resolveImageMode({
          imageConfig: this.imageConfig,
          cameraConfig: this.cameraConfig,
        }) === 'camera'
      ) {
        updateElementStyleFromMediaLayoutConfig(
          this,
          this.cameraConfig?.dimensions?.layout,
        );
        this.style.aspectRatio = aspectRatioToString({
          ratio: this.cameraConfig?.dimensions?.aspect_ratio,
        });
      } else {
        updateElementStyleFromMediaLayoutConfig(this);
        this.style.removeProperty('aspect-ratio');
      }
    }
  }

  protected _useZoomIfRequired(template: TemplateResult): TemplateResult {
    const zoomTarget = IMAGE_VIEW_ZOOM_TARGET_SENTINEL;
    const view = this.viewManagerEpoch?.manager.getView();
    const mode = resolveImageMode({
      imageConfig: this.imageConfig,
      cameraConfig: this.cameraConfig,
    });

    return this.imageConfig?.zoomable
      ? html` <advanced-camera-card-zoomer
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
          ${template}
        </advanced-camera-card-zoomer>`
      : template;
  }

  protected render(): TemplateResult | void {
    if (!this.hass || !this.cameraConfig) {
      return;
    }

    return this._useZoomIfRequired(html`
      <advanced-camera-card-image-updating-player
        ${ref(this._refImage)}
        .hass=${this.hass}
        .view=${this.viewManagerEpoch?.manager.getView()}
        .imageConfig=${this.imageConfig}
        .cameraConfig=${this.cameraConfig}
      >
      </advanced-camera-card-image-updating-player>
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
