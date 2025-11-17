import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CameraManager } from '../camera-manager/manager';
import { FoldersManager } from '../card-controller/folders/manager';
import { ViewItemManager } from '../card-controller/view/item-manager';
import { ViewManagerEpoch } from '../card-controller/view/types';
import { TimelineKeys } from '../components-lib/timeline/types';
import { ConditionStateManagerReadonlyInterface } from '../conditions/types';
import { TimelineConfig } from '../config/schema/timeline';
import { CardWideConfig } from '../config/schema/types';
import { HomeAssistant } from '../ha/types';
import basicBlockStyle from '../scss/basic-block.scss';
import { QueryClassifier } from '../view/query-classifier';
import './surround.js';
import './timeline-core.js';

@customElement('advanced-camera-card-timeline')
export class AdvancedCameraCardTimeline extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public timelineConfig?: TimelineConfig;

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

  protected _getKeys(): TimelineKeys | undefined {
    const query = this.viewManagerEpoch?.manager.getView()?.query;

    // If there's a query, try to extract camera IDs or folder info from it.
    if (QueryClassifier.isMediaQuery(query)) {
      const cameraIDs = query.getQueryCameraIDs();
      if (cameraIDs && cameraIDs.size) {
        return {
          type: 'camera',
          cameraIDs,
        };
      }
    } else if (QueryClassifier.isFolderQuery(query)) {
      const folderConfig = query.getQuery()?.folder;
      if (folderConfig) {
        return {
          type: 'folder',
          folder: folderConfig,
        };
      }
    }

    // Otherwise fall back to all cameras that support media queries.
    const cameraIDs = this.cameraManager?.getStore().getCameraIDsWithCapability({
      anyCapabilities: ['clips', 'snapshots', 'recordings'],
    });
    const folder = this.foldersManager?.getFolder() ?? null;

    return cameraIDs?.size
      ? {
          type: 'camera',
          cameraIDs,
        }
      : folder
        ? {
            type: 'folder',
            folder,
          }
        : undefined;
  }

  protected render(): TemplateResult | void {
    if (!this.timelineConfig) {
      return html``;
    }

    return html`
      <advanced-camera-card-timeline-core
        .hass=${this.hass}
        .viewManagerEpoch=${this.viewManagerEpoch}
        .timelineConfig=${this.timelineConfig}
        .thumbnailConfig=${this.timelineConfig.controls.thumbnails}
        .cameraManager=${this.cameraManager}
        .foldersManager=${this.foldersManager}
        .conditionStateManager=${this.conditionStateManager}
        .viewItemManager=${this.viewItemManager}
        .keys=${this._getKeys()}
        .cardWideConfig=${this.cardWideConfig}
        .itemClickAction=${this.timelineConfig.controls.thumbnails.mode === 'none'
          ? 'play'
          : 'select'}
      >
      </advanced-camera-card-timeline-core>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(basicBlockStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-timeline': AdvancedCameraCardTimeline;
  }
}
