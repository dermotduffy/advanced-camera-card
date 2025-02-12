import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { CameraManager } from '../camera-manager/manager.js';
import { MicrophoneState } from '../card-controller/types.js';
import { ViewManagerEpoch } from '../card-controller/view/types.js';
import {
  AdvancedCameraCardConfig,
  CardWideConfig,
  RawAdvancedCameraCardConfig,
} from '../config/types.js';
import viewsStyle from '../scss/views.scss';
import { ExtendedHomeAssistant } from '../types.js';
import { DeviceRegistryManager } from '../utils/ha/registry/device/index.js';
import { ResolvedMediaCache } from '../utils/ha/resolved-media.js';
import './surround.js';

// As a special case: The diagnostics view is not dynamically loaded in case
// something goes wrong.
import './diagnostics.js';

@customElement('advanced-camera-card-views')
export class AdvancedCameraCardViews extends LitElement {
  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public config?: AdvancedCameraCardConfig;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  @property({ attribute: false })
  public rawConfig?: RawAdvancedCameraCardConfig;

  @property({ attribute: false })
  public resolvedMediaCache?: ResolvedMediaCache;

  @property({ attribute: false })
  public hide?: boolean;

  @property({ attribute: false })
  public microphoneState?: MicrophoneState;

  @property({ attribute: false })
  public triggeredCameraIDs?: Set<string>;

  @property({ attribute: false })
  public deviceRegistryManager?: DeviceRegistryManager;

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('viewManagerEpoch') || changedProps.has('config')) {
      const view = this.viewManagerEpoch?.manager.getView();
      if (view?.is('live') || this._shouldLivePreload()) {
        import('./live/index.js');
      }
      if (view?.isGalleryView()) {
        import('./gallery.js');
      } else if (view?.isViewerView()) {
        import('./viewer/index.js');
      } else if (view?.is('image')) {
        import('./image.js');
      } else if (view?.is('timeline')) {
        import('./timeline.js');
      }
    }

    if (changedProps.has('hide')) {
      if (this.hide) {
        this.setAttribute('hidden', '');
      } else {
        this.removeAttribute('hidden');
      }
    }
  }

  protected _shouldLivePreload(): boolean {
    const view = this.viewManagerEpoch?.manager.getView();
    return (
      // Special case: Never preload for diagnostics -- we want that to be as
      // minimal as possible.
      !!this.config?.live.preload && !view?.is('diagnostics')
    );
  }

  protected render(): TemplateResult | void {
    // Only essential items should be added to the below list, since we want the
    // overall views pane to render in ~almost all cases (e.g. for a camera
    // initialization error to display, `view` and `cameraConfig` may both be
    // undefined, but we still want to render).
    if (!this.hass || !this.config || !this.cardWideConfig) {
      return html``;
    }

    const view = this.viewManagerEpoch?.manager.getView();

    // Render but hide the live view if there's a message, or if it's preload
    // mode and the view is not live.
    const liveClasses = {
      hidden: this._shouldLivePreload() && !view?.is('live'),
    };
    const overallClasses = {
      hidden: !!this.hide,
    };

    const thumbnailConfig = view?.is('live')
      ? this.config.live.controls.thumbnails
      : view?.isViewerView()
        ? this.config.media_viewer.controls.thumbnails
        : view?.is('timeline')
          ? this.config.timeline.controls.thumbnails
          : undefined;

    const miniTimelineConfig = view?.is('live')
      ? this.config.live.controls.timeline
      : view?.isViewerView()
        ? this.config.media_viewer.controls.timeline
        : undefined;

    const cameraConfig = view
      ? this.cameraManager?.getStore().getCameraConfig(view.camera) ?? null
      : null;

    return html` <advanced-camera-card-surround
      class="${classMap(overallClasses)}"
      .hass=${this.hass}
      .viewManagerEpoch=${this.viewManagerEpoch}
      .thumbnailConfig=${!this.hide ? thumbnailConfig : undefined}
      .timelineConfig=${!this.hide ? miniTimelineConfig : undefined}
      .cameraManager=${this.cameraManager}
      .cardWideConfig=${this.cardWideConfig}
    >
      ${!this.hide && view?.is('image') && cameraConfig
        ? html` <advanced-camera-card-image
            .imageConfig=${this.config.image}
            .viewManagerEpoch=${this.viewManagerEpoch}
            .hass=${this.hass}
            .cameraConfig=${cameraConfig}
            .cameraManager=${this.cameraManager}
          >
          </advanced-camera-card-image>`
        : ``}
      ${!this.hide && view?.isGalleryView()
        ? html` <advanced-camera-card-gallery
            .hass=${this.hass}
            .viewManagerEpoch=${this.viewManagerEpoch}
            .galleryConfig=${this.config.media_gallery}
            .cameraManager=${this.cameraManager}
            .cardWideConfig=${this.cardWideConfig}
          >
          </advanced-camera-card-gallery>`
        : ``}
      ${!this.hide && view?.isViewerView()
        ? html`
            <advanced-camera-card-viewer
              .hass=${this.hass}
              .viewManagerEpoch=${this.viewManagerEpoch}
              .viewerConfig=${this.config.media_viewer}
              .resolvedMediaCache=${this.resolvedMediaCache}
              .cameraManager=${this.cameraManager}
              .cardWideConfig=${this.cardWideConfig}
            >
            </advanced-camera-card-viewer>
          `
        : ``}
      ${!this.hide && view?.is('timeline')
        ? html` <advanced-camera-card-timeline
            .hass=${this.hass}
            .viewManagerEpoch=${this.viewManagerEpoch}
            .timelineConfig=${this.config.timeline}
            .cameraManager=${this.cameraManager}
            .cardWideConfig=${this.cardWideConfig}
          >
          </advanced-camera-card-timeline>`
        : ``}
      ${!this.hide && view?.is('diagnostics')
        ? html` <advanced-camera-card-diagnostics
            .hass=${this.hass}
            .rawConfig=${this.rawConfig}
            .deviceRegistryManager=${this.deviceRegistryManager}
          >
          </advanced-camera-card-diagnostics>`
        : ``}
      ${
        // Note: Subtle difference in condition below vs the other views in
        // order to always render the live view for live.preload mode.
        this._shouldLivePreload() || (!this.hide && view?.is('live'))
          ? html`
              <advanced-camera-card-live
                .hass=${this.hass}
                .viewManagerEpoch=${this.viewManagerEpoch}
                .liveConfig=${this.config.live}
                .cameraManager=${this.cameraManager}
                .cardWideConfig=${this.cardWideConfig}
                .microphoneState=${this.microphoneState}
                .triggeredCameraIDs=${this.triggeredCameraIDs}
                class="${classMap(liveClasses)}"
              >
              </advanced-camera-card-live>
            `
          : ``
      }
    </advanced-camera-card-surround>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(viewsStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-views': AdvancedCameraCardViews;
  }
}
