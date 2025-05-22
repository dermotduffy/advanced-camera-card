import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CameraManager } from '../../camera-manager/manager.js';
import { ViewManagerEpoch } from '../../card-controller/view/types.js';
import { CardWideConfig } from '../../config/schema/types.js';
import { ViewerConfig } from '../../config/schema/viewer.js';
import { ResolvedMediaCache } from '../../ha/resolved-media.js';
import { HomeAssistant } from '../../ha/types.js';
import { localize } from '../../localize/localize.js';
import '../../patches/ha-hls-player.js';
import viewerStyle from '../../scss/viewer.scss';
import { ViewItemClassifier } from '../../view/item-classifier.js';
import { renderMessage } from '../message.js';
import './grid';

export interface MediaViewerViewContext {
  seek?: Date;
}

declare module 'view' {
  interface ViewContext {
    mediaViewer?: MediaViewerViewContext;
  }
}

@customElement('advanced-camera-card-viewer')
export class AdvancedCameraCardViewer extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public viewerConfig?: ViewerConfig;

  @property({ attribute: false })
  public resolvedMediaCache?: ResolvedMediaCache;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  @property({ attribute: 'empty', reflect: true, type: Boolean })
  public isEmpty = false;

  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has('viewManagerEpoch')) {
      const view = this.viewManagerEpoch?.manager.getView();
      this.isEmpty = !view?.queryResults
        ?.getResults()
        ?.filter((result) => ViewItemClassifier.isMedia(result)).length;
    }
  }

  protected render(): TemplateResult | void {
    if (
      !this.hass ||
      !this.viewManagerEpoch ||
      !this.viewerConfig ||
      !this.cameraManager ||
      !this.cardWideConfig
    ) {
      return;
    }

    if (this.isEmpty) {
      // Directly render an error message (instead of dispatching it upwards)
      // to preserve the mini-timeline if the user pans into an area with no
      // media.
      const loadingMedia =
        !!this.viewManagerEpoch.manager.getView()?.context?.loading?.query;
      return renderMessage({
        type: 'info',
        message: loadingMedia
          ? localize('error.awaiting_media')
          : localize('common.no_media'),
        icon: 'mdi:multimedia',
        dotdotdot: loadingMedia,
      });
    }

    return html` <advanced-camera-card-viewer-grid
      .hass=${this.hass}
      .viewManagerEpoch=${this.viewManagerEpoch}
      .viewerConfig=${this.viewerConfig}
      .resolvedMediaCache=${this.resolvedMediaCache}
      .cameraManager=${this.cameraManager}
      .cardWideConfig=${this.cardWideConfig}
    >
    </advanced-camera-card-viewer-grid>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(viewerStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-viewer': AdvancedCameraCardViewer;
  }
}
