import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { CameraManager } from '../../camera-manager/manager.js';
import { ViewManagerEpoch } from '../../card-controller/view/types.js';
import { MediaGridSelected } from '../../components-lib/media-grid-controller.js';
import { CardWideConfig } from '../../config/schema/types.js';
import { ViewerConfig } from '../../config/schema/viewer.js';
import { ResolvedMediaCache } from '../../ha/resolved-media.js';
import { HomeAssistant } from '../../ha/types.js';
import '../../patches/ha-hls-player.js';
import basicBlockStyle from '../../scss/basic-block.scss';
import './carousel';

@customElement('advanced-camera-card-viewer-grid')
export class AdvancedCameraCardViewerGrid extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public viewerConfig?: ViewerConfig;

  @property({ attribute: false })
  public resolvedMediaCache?: ResolvedMediaCache;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public heightConstrained = false;

  protected _renderCarousel(filterCamera?: string): TemplateResult {
    const selectedCameraID = this.viewManagerEpoch?.manager.getView()?.camera;
    return html`
      <advanced-camera-card-viewer-carousel
        grid-id=${ifDefined(filterCamera)}
        .hass=${this.hass}
        .viewManagerEpoch=${this.viewManagerEpoch}
        .viewFilterCameraID=${filterCamera}
        .viewerConfig=${this.viewerConfig}
        .resolvedMediaCache=${this.resolvedMediaCache}
        .cameraManager=${this.cameraManager}
        .cardWideConfig=${this.cardWideConfig}
        .heightConstrained=${this.heightConstrained}
        .showControls=${!filterCamera || selectedCameraID === filterCamera}
      >
      </advanced-camera-card-viewer-carousel>
    `;
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('viewManagerEpoch') && this._needsGrid()) {
      import('../media-grid.js');
    }
  }

  protected _needsGrid(): boolean {
    const view = this.viewManagerEpoch?.manager.getView();
    const cameraIDs = view?.queryResults?.getCameraIDs();
    return (
      !!view?.isGrid() &&
      !!view?.supportsMultipleDisplayModes() &&
      (cameraIDs?.size ?? 0) > 1
    );
  }

  protected _gridSelectCamera(cameraID: string): void {
    const view = this.viewManagerEpoch?.manager.getView();
    this.viewManagerEpoch?.manager.setViewByParameters({
      params: {
        camera: cameraID,
        queryResults: view?.queryResults
          ?.clone()
          .promoteCameraSelectionToMainSelection(cameraID),
      },
    });
  }

  protected render(): TemplateResult {
    const view = this.viewManagerEpoch?.manager.getView();
    const cameraIDs = view?.queryResults?.getCameraIDs();
    if (!cameraIDs || !this._needsGrid()) {
      return this._renderCarousel();
    }

    return html`
      <advanced-camera-card-media-grid
        .selected=${view?.camera}
        .displayConfig=${this.viewerConfig?.display}
        @advanced-camera-card:media-grid:selected=${(
          ev: CustomEvent<MediaGridSelected>,
        ) => this._gridSelectCamera(ev.detail.selected)}
      >
        ${[...cameraIDs].map((cameraID) => this._renderCarousel(cameraID))}
      </advanced-camera-card-media-grid>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(basicBlockStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-viewer-grid': AdvancedCameraCardViewerGrid;
  }
}
