import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CameraManager } from '../camera-manager/manager.js';
import { RemoveContextViewModifier } from '../card-controller/view/modifiers/remove-context.js';
import { ViewManagerEpoch } from '../card-controller/view/types.js';
import { ThumbnailsControlConfig } from '../config/schema/common/controls/thumbnails.js';
import { MiniTimelineControlConfig } from '../config/schema/common/controls/timeline.js';
import { CardWideConfig } from '../config/schema/types.js';
import { HomeAssistant } from '../ha/types.js';
import basicBlockStyle from '../scss/basic-block.scss';
import { contentsChanged } from '../utils/basic.js';
import { fireAdvancedCameraCardEvent } from '../utils/fire-advanced-camera-card-event.js';
import './surround-basic.js';
import { ThumbnailCarouselTap } from './thumbnail-carousel.js';

@customElement('advanced-camera-card-surround')
export class AdvancedCameraCardSurround extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false, hasChanged: contentsChanged })
  public thumbnailConfig?: ThumbnailsControlConfig;

  @property({ attribute: false, hasChanged: contentsChanged })
  public timelineConfig?: MiniTimelineControlConfig;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  protected _cameraIDsForTimeline?: Set<string>;

  /**
   * Determine if a drawer is being used.
   * @returns `true` if a drawer is used, `false` otherwise.
   */
  protected _hasDrawer(): boolean {
    return (
      !!this.thumbnailConfig && ['left', 'right'].includes(this.thumbnailConfig.mode)
    );
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (this.timelineConfig?.mode && this.timelineConfig.mode !== 'none') {
      import('./timeline-core.js');
    }

    // Only reset the timeline cameraIDs when the media or display mode
    // materially changes (and not on every view change, since the view will
    // change frequently when the user is scrubbing video).
    const view = this.viewManagerEpoch?.manager.getView();
    if (
      changedProperties.has('viewManagerEpoch') &&
      (this.viewManagerEpoch?.manager.hasMajorMediaChange(
        this.viewManagerEpoch?.oldView,
      ) ||
        this.viewManagerEpoch?.oldView?.displayMode !== view?.displayMode)
    ) {
      this._cameraIDsForTimeline = this._getCameraIDsForTimeline() ?? undefined;
    }
  }

  protected _getCameraIDsForTimeline(): Set<string> | null {
    const view = this.viewManagerEpoch?.manager.getView();
    if (!view || !this.cameraManager) {
      return null;
    }

    if (view.is('live')) {
      const capabilitySearch = {
        anyCapabilities: ['clips' as const, 'snapshots' as const, 'recordings' as const],
      };
      if (view.supportsMultipleDisplayModes() && view.isGrid()) {
        return this.cameraManager
          .getStore()
          .getCameraIDsWithCapability(capabilitySearch);
      } else {
        return this.cameraManager
          .getStore()
          .getAllDependentCameras(view.camera, capabilitySearch);
      }
    }
    if (view.isViewerView()) {
      return view.query?.getQueryCameraIDs() ?? null;
    }
    return null;
  }

  protected render(): TemplateResult | void {
    const view = this.viewManagerEpoch?.manager.getView();
    if (!this.hass || !view) {
      return;
    }

    const changeDrawer = (ev: CustomEvent, action: 'open' | 'close') => {
      // The event catch/re-dispatch below protect encapsulation: Catches the
      // request to view thumbnails and re-dispatches a request to open the drawer
      // (if the thumbnails are in a drawer). The new event needs to be dispatched
      // from the origin of the inbound event, so it can be handled by
      // <advanced-camera-card-surround> .
      if (this.thumbnailConfig && this._hasDrawer()) {
        fireAdvancedCameraCardEvent(ev.composedPath()[0], 'drawer:' + action, {
          drawer: this.thumbnailConfig.mode,
        });
      }
    };

    return html` <advanced-camera-card-surround-basic
      @advanced-camera-card:thumbnails:open=${(ev: CustomEvent) =>
        changeDrawer(ev, 'open')}
      @advanced-camera-card:thumbnails:close=${(ev: CustomEvent) =>
        changeDrawer(ev, 'close')}
    >
      ${this.thumbnailConfig && this.thumbnailConfig.mode !== 'none'
        ? html` <advanced-camera-card-thumbnail-carousel
            slot=${this.thumbnailConfig.mode}
            .hass=${this.hass}
            .config=${this.thumbnailConfig}
            .cameraManager=${this.cameraManager}
            .fadeThumbnails=${view.isViewerView()}
            .viewManagerEpoch=${this.viewManagerEpoch}
            .selected=${view.queryResults?.getSelectedIndex() ?? undefined}
            @advanced-camera-card:thumbnail-carousel:tap=${(
              ev: CustomEvent<ThumbnailCarouselTap>,
            ) => {
              const media = ev.detail.queryResults.getSelectedResult();
              if (media) {
                this.viewManagerEpoch?.manager.setViewByParameters({
                  params: {
                    view: 'media',
                    queryResults: ev.detail.queryResults,
                    ...(media.getCameraID() && { camera: media.getCameraID() }),
                  },
                  modifiers: [
                    new RemoveContextViewModifier(['timeline', 'mediaViewer']),
                  ],
                });
                changeDrawer(ev, 'close');
              }
            }}
          >
          </advanced-camera-card-thumbnail-carousel>`
        : ''}
      ${this.timelineConfig && this.timelineConfig.mode !== 'none'
        ? html` <advanced-camera-card-timeline-core
            slot=${this.timelineConfig.mode}
            .hass=${this.hass}
            .viewManagerEpoch=${this.viewManagerEpoch}
            .itemClickAction=${view.isViewerView() ||
            !this.thumbnailConfig ||
            this.thumbnailConfig?.mode === 'none'
              ? 'play'
              : 'select'}
            .cameraIDs=${this._cameraIDsForTimeline}
            .mini=${true}
            .timelineConfig=${this.timelineConfig}
            .thumbnailConfig=${this.thumbnailConfig}
            .cameraManager=${this.cameraManager}
            .cardWideConfig=${this.cardWideConfig}
          >
          </advanced-camera-card-timeline-core>`
        : ''}
      <slot></slot>
    </advanced-camera-card-surround-basic>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(basicBlockStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-surround': AdvancedCameraCardSurround;
  }
}
