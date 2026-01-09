import {
  CSSResultGroup,
  LitElement,
  PropertyValues,
  TemplateResult,
  html,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { Ref, createRef, ref } from 'lit/directives/ref.js';
import type { IdType } from 'vis-timeline/esnext';
import { CameraManager } from '../camera-manager/manager';
import { FoldersManager } from '../card-controller/folders/manager';
import { ViewItemManager } from '../card-controller/view/item-manager';
import { ViewManagerEpoch } from '../card-controller/view/types';
import { TimelineController } from '../components-lib/timeline/controller';
import {
  ThumbnailDataRequest,
  ThumbnailDataRequestEvent,
  TimelineItemClickAction,
} from '../components-lib/timeline/types';
import { ConditionStateManagerReadonlyInterface } from '../conditions/types';
import { ThumbnailsControlBaseConfig } from '../config/schema/common/controls/thumbnails';
import { TimelineCoreConfig } from '../config/schema/common/controls/timeline';
import { CardWideConfig } from '../config/schema/types';
import { HomeAssistant } from '../ha/types';
import { localize } from '../localize/localize';
import timelineCoreStyle from '../scss/timeline-core.scss';
import { contentsChanged } from '../utils/basic';
import './date-picker.js';
import { AdvancedCameraCardDatePicker, DatePickerEvent } from './date-picker.js';
import './icon';
import { renderMessage } from './message';
import './thumbnail/thumbnail.js';

/**
 * A simple thumbnail wrapper class for use in the timeline where Lit data
 * bindings are not available.
 */
@customElement('advanced-camera-card-timeline-thumbnail')
export class AdvancedCameraCardTimelineThumbnail extends LitElement {
  @property({ attribute: true })
  public item?: IdType;

  @property({ attribute: true, type: Boolean })
  public details = false;

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    if (!this.item) {
      return html``;
    }

    /* Special note on what's going on here:
     *
     * This component does not have access to a variety of properties required
     * to render a thumbnail component, as there's no way to pass them in via the
     * string-based tooltip that timeline supports. Instead dispatch an event to
     * request HASS which the timeline adds to the event object before execution
     * continues.
     */

    const dataRequest: ThumbnailDataRequest = {
      item: this.item,
    };
    this.dispatchEvent(
      new ThumbnailDataRequestEvent(
        `advanced-camera-card:timeline:thumbnail-data-request`,
        {
          composed: true,
          bubbles: true,
          detail: dataRequest,
        },
      ),
    );

    if (
      !dataRequest.hass ||
      !dataRequest.cameraManager ||
      !dataRequest.cameraConfig ||
      !dataRequest.viewItemManager ||
      !dataRequest.media ||
      !dataRequest.viewManagerEpoch
    ) {
      return html``;
    }

    return html` <advanced-camera-card-thumbnail
      .hass=${dataRequest.hass}
      .cameraManager=${dataRequest.cameraManager}
      .viewItemManager=${dataRequest.viewItemManager}
      .item=${dataRequest.media}
      .viewManagerEpoch=${dataRequest.viewManagerEpoch}
      ?details=${this.details}
    >
    </advanced-camera-card-thumbnail>`;
  }
}

@customElement('advanced-camera-card-timeline-core')
export class AdvancedCameraCardTimelineCore extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false, hasChanged: contentsChanged })
  public timelineConfig?: TimelineCoreConfig;

  @property({ attribute: false })
  public thumbnailConfig?: ThumbnailsControlBaseConfig;

  // Whether or not this is a mini-timeline (in mini-mode the component takes a
  // supportive role for other views).
  @property({ attribute: true, type: Boolean, reflect: true })
  public mini = false;

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

  @property({ attribute: false })
  public itemClickAction?: TimelineItemClickAction;

  protected _refDatePicker: Ref<AdvancedCameraCardDatePicker> = createRef();
  protected _refTimeline: Ref<HTMLElement> = createRef();
  protected _controller: TimelineController = new TimelineController(this);

  protected render(): TemplateResult | void {
    if (!this.hass || !this.timelineConfig) {
      return;
    }

    const view = this.viewManagerEpoch?.manager.getView();
    const isLoading = !!view?.context?.loading?.query;

    if (isLoading) {
      if (!this.mini) {
        return renderMessage({
          message: localize('error.awaiting_media'),
          icon: 'mdi:chart-gantt',
          type: 'info',
          dotdotdot: true,
        });
      }
      return;
    }

    if (!view?.query || !view.query.hasNodes()) {
      if (!this.mini) {
        return renderMessage({
          message: localize('error.no_camera_or_media_for_timeline'),
          icon: 'mdi:chart-gantt',
          type: 'info',
        });
      }
      return;
    }

    const panMode = this._controller.getEffectivePanMode();

    const panTitle =
      panMode === 'pan'
        ? localize('config.common.controls.timeline.pan_modes.pan')
        : panMode === 'seek'
          ? localize('config.common.controls.timeline.pan_modes.seek')
          : panMode === 'seek-in-media'
            ? localize('config.common.controls.timeline.pan_modes.seek-in-media')
            : localize('config.common.controls.timeline.pan_modes.seek-in-camera');
    const panIcon =
      panMode === 'pan'
        ? 'mdi:pan-horizontal'
        : panMode === 'seek'
          ? 'mdi:filmstrip-box-multiple'
          : panMode === 'seek-in-media'
            ? 'mdi:play-box-lock'
            : 'mdi:camera-lock';

    return html` <div
      @advanced-camera-card:timeline:thumbnail-data-request=${this._controller
        .handleThumbnailDataRequest}
      class="timeline"
      ${ref(this._refTimeline)}
    >
      <div class="timeline-tools">
        ${this._controller.shouldSupportSeeking()
          ? html` <advanced-camera-card-icon
              .icon=${{ icon: panIcon }}
              @click=${() => this._controller.cyclePanMode()}
              aria-label="${panTitle}"
              title="${panTitle}"
            >
            </advanced-camera-card-icon>`
          : ''}
        <advanced-camera-card-date-picker
          ${ref(this._refDatePicker)}
          @advanced-camera-card:date-picker:change=${(
            ev: CustomEvent<DatePickerEvent>,
          ) => {
            if (ev.detail.date) {
              this._controller.setTimelineDate(ev.detail.date);
            }
          }}
        >
        </advanced-camera-card-date-picker>
      </div>
    </div>`;
  }

  /**
   * Determine if the component should be updated.
   * @param _changedProps The changed properties.
   * @returns
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected shouldUpdate(_changedProps: PropertyValues): boolean {
    return !!this.hass && !!this.cameraManager;
  }

  /**
   * Called when an update will occur.
   * @param changedProps The changed properties
   */
  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('hass')) {
      this._controller.setHass(this.hass ?? null);
    }

    if (
      [
        'viewManagerEpoch',
        'cameraManager',
        'viewItemManager',
        'timelineConfig',
        'mini',
        'thumbnailConfig',
        'conditionStateManager',
        'foldersManager',
      ].some((prop) => changedProps.has(prop))
    ) {
      this._controller.setOptions({
        cameraManager: this.cameraManager,
        foldersManager: this.foldersManager,
        viewItemManager: this.viewItemManager,
        conditionStateManager: this.conditionStateManager,
        timelineConfig: this.timelineConfig,
        mini: this.mini,
        thumbnailConfig: this.thumbnailConfig,
        query: this.viewManagerEpoch?.manager.getView()?.query ?? undefined,
      });
    }
  }

  protected updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);
    if (this._controller.setTimelineElement(this._refTimeline.value)) {
      // If the timeline was just created, give it one frame to draw itself.
      // Failure to do so may result in subsequent calls to
      // `this._timeline.setwindow()` being entirely ignored. Example case:
      // Clicking the timeline control on a recording thumbnail.
      window.requestAnimationFrame(() =>
        this._controller.setView(this.viewManagerEpoch ?? null),
      );
    } else {
      this._controller.setView(this.viewManagerEpoch ?? null);
    }
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(timelineCoreStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-timeline-thumbnail': AdvancedCameraCardTimelineThumbnail;
    'advanced-camera-card-timeline-core': AdvancedCameraCardTimelineCore;
  }
}
