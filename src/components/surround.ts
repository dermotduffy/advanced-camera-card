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
import { FoldersManager } from '../card-controller/folders/manager.js';
import { ViewItemManager } from '../card-controller/view/item-manager.js';
import { ViewManagerEpoch } from '../card-controller/view/types.js';
import { ConditionStateManagerReadonlyInterface } from '../conditions/types.js';
import { ThumbnailsControlConfig } from '../config/schema/common/controls/thumbnails.js';
import { MiniTimelineControlConfig } from '../config/schema/common/controls/timeline.js';
import { LiveThumbnailsControlConfig } from '../config/schema/live.js';
import { TimelineThumbnailsControlConfig } from '../config/schema/timeline.js';
import { CardWideConfig } from '../config/schema/types.js';
import { HomeAssistant } from '../ha/types.js';
import basicBlockStyle from '../scss/basic-block.scss';
import { contentsChanged } from '../utils/basic.js';
import { fireAdvancedCameraCardEvent } from '../utils/fire-advanced-camera-card-event.js';
import './surround-basic.js';
import './thumbnail-carousel';

@customElement('advanced-camera-card-surround')
export class AdvancedCameraCardSurround extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false, hasChanged: contentsChanged })
  public thumbnailConfig?: ThumbnailsControlConfig &
    Partial<LiveThumbnailsControlConfig> &
    Partial<TimelineThumbnailsControlConfig>;

  @property({ attribute: false, hasChanged: contentsChanged })
  public timelineConfig?: MiniTimelineControlConfig;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public foldersManager?: FoldersManager;

  @property({ attribute: false })
  public conditionStateManager?: ConditionStateManagerReadonlyInterface;

  @property({ attribute: false })
  public viewItemManager?: ViewItemManager;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  /**
   * Determine if a drawer is being used.
   */
  protected _hasDrawer(): boolean {
    return (
      !!this.thumbnailConfig && ['left', 'right'].includes(this.thumbnailConfig.mode)
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected willUpdate(_changedProperties: PropertyValues): void {
    if (this.timelineConfig?.mode && this.timelineConfig.mode !== 'none') {
      import('./timeline-core.js');
    }
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
      @advanced-camera-card:thumbnails-carousel:media-select=${(ev: CustomEvent) =>
        changeDrawer(ev, 'close')}
    >
      ${this.thumbnailConfig && this.thumbnailConfig.mode !== 'none'
        ? html` <advanced-camera-card-thumbnail-carousel
            slot=${this.thumbnailConfig.mode}
            .hass=${this.hass}
            .config=${this.thumbnailConfig}
            .cameraManager=${this.cameraManager}
            .viewItemManager=${this.viewItemManager}
            .fadeThumbnails=${view.isViewerView()}
            .viewManagerEpoch=${this.viewManagerEpoch}
            .selected=${view.queryResults?.getSelectedIndex() ?? undefined}
            .cardWideConfig=${this.cardWideConfig}
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
            .mini=${true}
            .timelineConfig=${this.timelineConfig}
            .thumbnailConfig=${this.thumbnailConfig}
            .cameraManager=${this.cameraManager}
            .foldersManager=${this.foldersManager}
            .conditionStateManager=${this.conditionStateManager}
            .viewItemManager=${this.viewItemManager}
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
