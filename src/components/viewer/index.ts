import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CameraManager } from '../../camera-manager/manager.js';
import { ViewManagerEpoch } from '../../card-controller/view/types.js';
import { CardWideConfig, ViewerConfig } from '../../config/types.js';
import { localize } from '../../localize/localize.js';
import '../../patches/ha-hls-player.js';
import viewerStyle from '../../scss/viewer.scss';
import { ExtendedHomeAssistant } from '../../types.js';
import { ResolvedMediaCache } from '../../utils/ha/resolved-media.js';
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

@customElement('frigate-card-viewer')
export class FrigateCardViewer extends LitElement {
  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

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

    if (!this.viewManagerEpoch.manager.getView()?.queryResults?.hasResults()) {
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

    return html` <frigate-card-viewer-grid
      .hass=${this.hass}
      .viewManagerEpoch=${this.viewManagerEpoch}
      .viewerConfig=${this.viewerConfig}
      .resolvedMediaCache=${this.resolvedMediaCache}
      .cameraManager=${this.cameraManager}
      .cardWideConfig=${this.cardWideConfig}
    >
    </frigate-card-viewer-grid>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(viewerStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-viewer': FrigateCardViewer;
  }
}
