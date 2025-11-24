import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { isEqual } from 'lodash-es';
import { CameraManager } from '../camera-manager/manager.js';
import { FoldersManager } from '../card-controller/folders/manager.js';
import { ViewItemManager } from '../card-controller/view/item-manager.js';
import { ViewManagerEpoch } from '../card-controller/view/types.js';
import { TimelineKeys } from '../components-lib/timeline/types.js';
import { ConditionStateManagerReadonlyInterface } from '../conditions/types.js';
import { ThumbnailsControlConfig } from '../config/schema/common/controls/thumbnails.js';
import { MiniTimelineControlConfig } from '../config/schema/common/controls/timeline.js';
import { FolderConfig } from '../config/schema/folders.js';
import { CardWideConfig } from '../config/schema/types.js';
import { HomeAssistant } from '../ha/types.js';
import basicBlockStyle from '../scss/basic-block.scss';
import { contentsChanged } from '../utils/basic.js';
import { fireAdvancedCameraCardEvent } from '../utils/fire-advanced-camera-card-event.js';
import { QueryClassifier } from '../view/query-classifier.js';
import './surround-basic.js';
import './thumbnail-carousel';

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
  public foldersManager?: FoldersManager;

  @property({ attribute: false })
  public conditionStateManager?: ConditionStateManagerReadonlyInterface;

  @property({ attribute: false })
  public viewItemManager?: ViewItemManager;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  protected _timelineKeys?: TimelineKeys | null = null;

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
      const newKeys = this._getTimelineKeys();
      // Update only if changed, to avoid unnecessary timeline destructions.
      if (!isEqual(newKeys, this._timelineKeys)) {
        this._timelineKeys = newKeys ?? undefined;
      }
    }
  }

  protected _getTimelineKeys(): TimelineKeys | null {
    const cameraIDsToKeys = (cameraIDs: Set<string> | null): TimelineKeys | null => {
      return cameraIDs?.size
        ? {
            type: 'camera',
            cameraIDs,
          }
        : null;
    };

    const folderToKeys = (folderConfig: FolderConfig): TimelineKeys => {
      return {
        type: 'folder',
        folder: folderConfig,
      };
    };

    const view = this.viewManagerEpoch?.manager.getView();
    if (!view || !this.cameraManager) {
      return null;
    }

    if (view.is('live')) {
      const capabilitySearch = {
        anyCapabilities: ['clips' as const, 'snapshots' as const, 'recordings' as const],
      };
      if (view.supportsMultipleDisplayModes() && view.isGrid()) {
        return cameraIDsToKeys(
          this.cameraManager.getStore().getCameraIDsWithCapability(capabilitySearch),
        );
      } else {
        return cameraIDsToKeys(
          this.cameraManager
            .getStore()
            .getAllDependentCameras(view.camera, capabilitySearch),
        );
      }
    }

    const queries = view.query;
    if (view.isViewerView()) {
      if (QueryClassifier.isMediaQuery(queries)) {
        return cameraIDsToKeys(queries.getQueryCameraIDs());
      } else if (QueryClassifier.isFolderQuery(queries)) {
        const folderConfig = queries.getQuery()?.folder;
        return folderConfig ? folderToKeys(folderConfig) : null;
      }
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
            .keys=${this._timelineKeys}
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
