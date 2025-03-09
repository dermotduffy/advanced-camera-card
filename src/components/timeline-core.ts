import { add, differenceInSeconds, sub } from 'date-fns';
import {
  CSSResultGroup,
  LitElement,
  PropertyValues,
  TemplateResult,
  html,
  unsafeCSS,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { Ref, createRef, ref } from 'lit/directives/ref.js';
import isEqual from 'lodash-es/isEqual';
import throttle from 'lodash-es/throttle';
import { ViewContext } from 'view';
import { DataSet } from 'vis-data/esnext';
import type {
  DataGroupCollectionType,
  DateType,
  IdType,
  TimelineFormatOption,
} from 'vis-timeline/esnext';
import {
  Timeline,
  TimelineEventPropertiesResult,
  TimelineItem,
  TimelineOptions,
  TimelineOptionsCluster,
  TimelineWindow,
} from 'vis-timeline/esnext';
import { CameraManager } from '../camera-manager/manager';
import { rangesOverlap } from '../camera-manager/range';
import { MediaQuery } from '../camera-manager/types';
import { convertRangeToCacheFriendlyTimes } from '../camera-manager/utils/range-to-cache-friendly';
import { MergeContextViewModifier } from '../card-controller/view/modifiers/merge-context';
import { ViewManagerEpoch } from '../card-controller/view/types';
import {
  AdvancedCameraCardTimelineItem,
  TimelineDataSource,
} from '../components-lib/timeline-source';
import {
  AdvancedCameraCardView,
  CameraConfig,
  CardWideConfig,
  ThumbnailsControlBaseConfig,
  TimelineCoreConfig,
  TimelinePanMode,
  configDefaults,
} from '../config/types';
import { HomeAssistant } from '../ha/types';
import { localize } from '../localize/localize';
import timelineCoreStyle from '../scss/timeline-core.scss';
import { stopEventFromActivatingCardWideActions } from '../utils/action';
import {
  contentsChanged,
  formatDateAndTime,
  isHoverableDevice,
  isTruthy,
  setOrRemoveAttribute,
} from '../utils/basic';
import { findBestMediaIndex } from '../utils/find-best-media-index';
import { fireAdvancedCameraCardEvent } from '../utils/fire-advanced-camera-card-event';
import { ViewMedia } from '../view/media';
import { ViewMediaClassifier } from '../view/media-classifier';
import {
  EventMediaQueries,
  MediaQueries,
  RecordingMediaQueries,
} from '../view/media-queries';
import {
  MediaQueriesClassifier,
  MediaQueriesType,
} from '../view/media-queries-classifier';
import { MediaQueriesResults } from '../view/media-queries-results';
import { mergeViewContext } from '../view/view';
import './date-picker.js';
import { AdvancedCameraCardDatePicker, DatePickerEvent } from './date-picker.js';
import './icon';
import './thumbnail.js';

interface AdvancedCameraCardGroupData {
  id: string;
  content: string;
}

interface TimelineRangeChange extends TimelineWindow {
  event: Event & { additionalEvent?: string };
  byUser: boolean;
}

interface TimelineViewContext {
  window?: TimelineWindow;
}

type TimelineItemClickAction = 'play' | 'select';

declare module 'view' {
  interface ViewContext {
    timeline?: TimelineViewContext;
  }
}

interface ExtendedTimeline extends Timeline {
  // setCustomTimeMarker currently missing from Timeline types.
  setCustomTimeMarker?(time: DateType, id?: IdType): void;
}

// An event used to fetch data required for thumbnail rendering. See special
// note below on why this is necessary.
interface ThumbnailDataRequest {
  item: IdType;
  hass?: HomeAssistant;
  cameraManager?: CameraManager;
  cameraConfig?: CameraConfig;
  media?: ViewMedia;
  viewManagerEpoch?: ViewManagerEpoch;
}

class ThumbnailDataRequestEvent extends CustomEvent<ThumbnailDataRequest> {}

const TIMELINE_TARGET_BAR_ID = 'target_bar';

/**
 * A simgple thumbnail wrapper class for use in the timeline where Lit data
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
      !dataRequest.media ||
      !dataRequest.viewManagerEpoch
    ) {
      return html``;
    }

    return html` <advanced-camera-card-thumbnail
      .hass=${dataRequest.hass}
      .cameraManager=${dataRequest.cameraManager}
      .media=${dataRequest.media}
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

  // Which cameraIDs to include in the timeline. If not specified, all cameraIDs
  // are shown.
  @property({ attribute: false, hasChanged: contentsChanged })
  public cameraIDs?: Set<string>;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  @property({ attribute: false })
  public itemClickAction?: TimelineItemClickAction;

  @state()
  protected _panMode: TimelinePanMode | null = null;

  protected _targetBarVisible = false;

  protected _refDatePicker: Ref<AdvancedCameraCardDatePicker> = createRef();
  protected _refTimeline: Ref<HTMLElement> = createRef();
  protected _timeline?: ExtendedTimeline;

  protected _timelineSource: TimelineDataSource | null = null;

  // Need a way to separate when a user clicks (to pan the timeline) vs when a
  // user clicks (to choose a recording (non-event) to play).
  protected _pointerHeld:
    | (TimelineEventPropertiesResult & { window?: TimelineWindow })
    | null = null;
  protected _ignoreClick = false;

  protected readonly _isHoverableDevice = isHoverableDevice();

  // Range changes are volumonous: throttle the calls on seeking.
  protected _throttledSetViewDuringRangeChange = throttle(
    this._setViewDuringRangeChange.bind(this),
    1000 / 10,
  );

  /**
   * Get a tooltip for a given timeline event.
   * @param item The TimelineItem in question.
   * @returns The tooltip as a string to render.
   */
  protected _getTooltip(item: TimelineItem): string {
    if (!this._isHoverableDevice) {
      // Don't display tooltips on touch devices, they just get in the way of
      // the drawer.
      return '';
    }

    // Cannot use Lit data-bindings as visjs requires a string for tooltips.
    // Note that changes to attributes here must be mirrored in the xss
    // whitelist in `_getOptions()` .
    return `
      <advanced-camera-card-timeline-thumbnail
        item='${item.id}'
        ${this.thumbnailConfig?.show_details ? 'details' : ''}
      >
      </advanced-camera-card-timeline-thumbnail>`;
  }

  protected _handleThumbnailDataRequest(request: ThumbnailDataRequestEvent): void {
    const item = request.detail.item;
    const media = this._timelineSource?.dataset.get(item)?.media;
    const cameraConfig = media
      ? this.cameraManager?.getStore().getCameraConfigForMedia(media) ?? undefined
      : undefined;

    request.detail.hass = this.hass;
    request.detail.cameraConfig = cameraConfig;
    request.detail.cameraManager = this.cameraManager;
    request.detail.media = media;
    request.detail.viewManagerEpoch = this.viewManagerEpoch;
  }

  protected render(): TemplateResult | void {
    if (!this.hass || !this.timelineConfig || !this.cameraIDs?.size) {
      return;
    }

    const panMode = this._getEffectivePanMode();

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
      @advanced-camera-card:timeline:thumbnail-data-request=${this._handleThumbnailDataRequest.bind(
        this,
      )}
      class="timeline"
      ${ref(this._refTimeline)}
    >
      <div class="timeline-tools">
        ${this._shouldSupportSeeking()
          ? html` <advanced-camera-card-icon
              .icon=${{ icon: panIcon }}
              @click=${() => {
                this._panMode =
                  panMode === 'pan'
                    ? 'seek'
                    : panMode === 'seek'
                      ? 'seek-in-media'
                      : panMode === 'seek-in-media'
                        ? 'seek-in-camera'
                        : 'pan';
              }}
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
              this._timeline?.moveTo(ev.detail.date);
            }
          }}
        >
        </advanced-camera-card-date-picker>
      </div>
    </div>`;
  }

  /**
   * Called whenever the range is in the process of being changed.
   * @param properties
   */
  protected _timelineRangeChangeHandler(properties: TimelineRangeChange): void {
    if (this._pointerHeld) {
      this._ignoreClick = true;
    }

    if (
      this._shouldSupportSeeking() &&
      this._timeline &&
      properties.byUser &&
      // Do not adjust select/seek media during zoom events.
      properties.event.type !== 'wheel' &&
      properties.event.additionalEvent !== 'pinchin' &&
      properties.event.additionalEvent !== 'pinchout'
    ) {
      const targetTime = this._pointerHeld?.window
        ? add(properties.start, {
            seconds:
              (this._pointerHeld.time.getTime() -
                this._pointerHeld.window.start.getTime()) /
              1000,
          })
        : properties.end;

      if (this._pointerHeld) {
        this._setTargetBarAppropriately(targetTime);
      }

      this._throttledSetViewDuringRangeChange(targetTime, properties);
    }
  }

  protected _shouldSupportSeeking(): boolean {
    return this.mini;
  }

  /**
   * Set the target bar at a given time.
   * @param targetTime
   */
  protected _setTargetBarAppropriately(targetTime: Date): void {
    if (!this._timeline) {
      return;
    }

    const view = this.viewManagerEpoch?.manager.getView();
    const panMode = this._getEffectivePanMode();
    const targetBarOn =
      this._shouldSupportSeeking() &&
      (panMode === 'seek' ||
        ((panMode === 'seek-in-camera' || panMode === 'seek-in-media') &&
          this._timeline.getSelection().some((id) => {
            const item = this._timelineSource?.dataset?.get(id);
            return (
              panMode !== 'seek-in-camera' ||
                item?.media?.getCameraID() === view?.camera,
              item &&
                item.start &&
                item.end &&
                targetTime.getTime() >= item.start &&
                targetTime.getTime() <= item.end
            );
          })));

    if (targetBarOn) {
      if (!this._targetBarVisible) {
        this._timeline?.addCustomTime(targetTime, TIMELINE_TARGET_BAR_ID);
        this._targetBarVisible = true;
      } else {
        this._timeline?.setCustomTime(targetTime, TIMELINE_TARGET_BAR_ID);
      }

      const window = this._timeline.getWindow();
      const markerProportion =
        (targetTime.getTime() - window.start.getTime()) /
        (window.end.getTime() - window.start.getTime());

      // Position the marker proportionally to how 'far' the pointer is being
      // held relative to the timeline window.
      this.setAttribute(
        'target-bar-marker-direction',
        markerProportion < 0.25 ? 'right' : markerProportion > 0.75 ? 'left' : 'center',
      );
      this._timeline?.setCustomTimeMarker?.(
        formatDateAndTime(targetTime, true),
        TIMELINE_TARGET_BAR_ID,
      );
    } else {
      this._removeTargetBar();
    }
  }

  /**
   * Remove the target bar.
   */
  protected _removeTargetBar(): void {
    this.removeAttribute('target-bar-direction');
    if (this._targetBarVisible) {
      this._timeline?.removeCustomTime(TIMELINE_TARGET_BAR_ID);
      this._targetBarVisible = false;
    }
  }

  /**
   * Set the view during a range change.
   * @param targetTime The target time.
   * @param properties The range change properties.
   * @returns
   */
  protected async _setViewDuringRangeChange(
    targetTime: Date,
    properties: TimelineRangeChange,
  ): Promise<void> {
    const view = this.viewManagerEpoch?.manager.getView();
    const results = view?.queryResults;
    const media = results?.getResults();
    const panMode = this._getEffectivePanMode();
    if (
      !media ||
      !results ||
      !this._timeline ||
      !view ||
      !this.hass ||
      !this.cameraManager ||
      panMode === 'pan'
    ) {
      return;
    }

    const canSeek = this._shouldSupportSeeking();
    let newResults: MediaQueriesResults | null = null;

    if (panMode === 'seek') {
      newResults = results
        .clone()
        .selectBestResult(
          (mediaArray) => findBestMediaIndex(mediaArray, targetTime, view?.camera),
          {
            allCameras: true,
            main: true,
          },
        );
    } else if (panMode === 'seek-in-camera') {
      newResults = results
        .clone()
        .selectBestResult((mediaArray) => findBestMediaIndex(mediaArray, targetTime), {
          cameraID: view.camera,
        })
        .promoteCameraSelectionToMainSelection(view.camera);
    } else if (panMode === 'seek-in-media') {
      newResults = results;
    }

    const desiredView: AdvancedCameraCardView = this.mini
      ? targetTime >= new Date()
        ? 'live'
        : 'media'
      : view.view;

    const selectedCamera = newResults?.getSelectedResult()?.getCameraID();

    this.viewManagerEpoch?.manager.setViewByParameters({
      params: {
        ...(selectedCamera && { camera: selectedCamera }),
        view: desiredView,
        queryResults: newResults,
      },
      modifiers: [
        new MergeContextViewModifier({
          ...(canSeek && { mediaViewer: { seek: targetTime } }),
          ...this._getTimelineContext({ start: properties.start, end: properties.end }),
        }),
      ],
    });
  }

  protected _getEffectivePanMode(): TimelinePanMode {
    return this._panMode ?? this.timelineConfig?.pan_mode ?? 'pan';
  }

  /**
   * Called whenever the timeline is clicked.
   * @param properties The properties of the timeline click event.
   */
  protected async _timelineClickHandler(
    properties: TimelineEventPropertiesResult,
  ): Promise<void> {
    // Calls to stopEventFromActivatingCardWideActions() are included for
    // completeness. Timeline does not support card-wide events and they are
    // disabled in card.ts in `_getMergedActions`.
    if (
      this._ignoreClick ||
      (properties.what &&
        ['item', 'background', 'group-label', 'axis'].includes(properties.what))
    ) {
      stopEventFromActivatingCardWideActions(properties.event);
    }

    const view = this.viewManagerEpoch?.manager.getView();

    if (
      this._ignoreClick ||
      !view ||
      !this.viewManagerEpoch ||
      !this._timelineSource ||
      !properties.what
    ) {
      return;
    }

    let drawerAction: 'open' | 'close' = 'close';

    if (
      this.timelineConfig?.show_recordings &&
      properties.time &&
      ['background', 'axis'].includes(properties.what)
    ) {
      const query = this._createMediaQueries('recording');
      if (query) {
        await this.viewManagerEpoch?.manager.setViewByParametersWithExistingQuery({
          baseView: view,
          params: { view: 'recording', query: query },
          queryExecutorOptions: {
            selectResult: {
              time: {
                time: properties.time,
              },
            },
          },
        });
      }
    } else if (properties.item && properties.what === 'item') {
      const cameraID = String(properties.group);
      const id = String(properties.item);

      const criteria = {
        main: true,
        ...(cameraID && view.isGrid() && { cameraID: cameraID }),
      };
      const newResults = view.queryResults
        ?.clone()
        .resetSelectedResult()
        .selectResultIfFound((media) => media.getID() === properties.item, criteria);

      const context: ViewContext = mergeViewContext(this._getTimelineContext(), {
        mediaViewer: { seek: properties.time },
      });

      if (!newResults || !newResults.hasSelectedResult()) {
        // This can happen in a few situations:
        // - If this is a recording query (with recorded hours) and an event is
        //   clicked on the timeline
        // - If the current thumbnails/results is a filtered view from the media
        //   gallery (i.e. any case where the thumbnails may not be match the
        //   events on the timeline, e.g. in the snapshots viewer but
        //   mini-timeline showing all media).
        const query = this._createMediaQueries('event');
        if (query) {
          await this.viewManagerEpoch?.manager.setViewByParametersWithExistingQuery({
            params: { view: 'media', query: query },
            queryExecutorOptions: {
              selectResult: {
                id: id,
              },
              rejectResults: (results) => !results.hasResults(),
            },
            modifiers: [new MergeContextViewModifier(context)],
          });
        }
      } else {
        this.viewManagerEpoch.manager.setViewByParameters({
          params: {
            queryResults: newResults,
            view: this.itemClickAction === 'play' ? 'media' : view.view,
          },
          modifiers: [new MergeContextViewModifier(context)],
        });
      }

      if (this.itemClickAction === 'select') {
        drawerAction = 'open';
      }
    }

    fireAdvancedCameraCardEvent(this, `thumbnails:${drawerAction}`);

    this._ignoreClick = false;
  }

  /**
   * Get a broader prefetch window from a start and end basis.
   * @param window The window to broaden.
   * @returns A broader timeline.
   */
  protected _getPrefetchWindow(window: TimelineWindow): TimelineWindow {
    const delta = differenceInSeconds(window.end, window.start);
    return {
      start: sub(window.start, { seconds: delta }),
      end: add(window.end, { seconds: delta }),
    };
  }

  /**
   * Handle a range change in the timeline.
   * @param properties vis.js provided range information.
   */
  protected async _timelineRangeChangedHandler(properties: {
    start: Date;
    end: Date;
    byUser: boolean;
    event: Event & { additionalEvent: string };
  }): Promise<void> {
    this._removeTargetBar();
    const view = this.viewManagerEpoch?.manager.getView();

    if (
      !this._timeline ||
      !view ||
      // When in mini mode, something else is in charge of the primary media
      // population (e.g. the live view), in this case only act when the user
      // themselves are interacting with the timeline.
      (this.mini && !properties.byUser)
    ) {
      return;
    }

    await this._timelineSource?.refresh(this._getPrefetchWindow(properties));

    const queryType = MediaQueriesClassifier.getQueriesType(view.query);
    if (!queryType) {
      return;
    }
    const mediaQuery = this._createMediaQueries(queryType);
    if (!mediaQuery || this._alreadyHasAcceptableMediaQuery(mediaQuery)) {
      return;
    }

    await this.viewManagerEpoch?.manager.setViewByParametersWithExistingQuery({
      params: {
        query: mediaQuery,
      },
      queryExecutorOptions: {
        selectResult: {
          id:
            this.viewManagerEpoch?.manager
              .getView()
              ?.queryResults?.getSelectedResult()
              ?.getID() ?? undefined,
        },
      },
      modifiers: [new MergeContextViewModifier(this._getTimelineContext())],
    });
  }

  protected _createMediaQueries(
    type: MediaQueriesType,
    options?: {
      window?: TimelineWindow;
    },
  ): MediaQueries | null {
    if (!this._timeline || !this._timelineSource) {
      return null;
    }

    const cacheFriendlyWindow = convertRangeToCacheFriendlyTimes(
      this._getPrefetchWindow(options?.window ?? this._timeline.getWindow()),
    );

    if (type === 'event') {
      const queries = this._timelineSource.getTimelineEventQueries(cacheFriendlyWindow);
      return queries ? new EventMediaQueries(queries) : null;
    } else if (type === 'recording') {
      const queries =
        this._timelineSource.getTimelineRecordingQueries(cacheFriendlyWindow);
      return queries ? new RecordingMediaQueries(queries) : null;
    }
    return null;
  }

  /**
   * Build the visjs dataset to render on the timeline.
   * @returns The dataset.
   */
  protected _getGroups(): DataGroupCollectionType {
    const groups: AdvancedCameraCardGroupData[] = [];
    (this.cameraIDs ?? []).forEach((cameraID: string) => {
      if (!this.hass || !this.cameraManager) {
        return;
      }
      const cameraMetadata = this.cameraManager.getCameraMetadata(cameraID);

      if (cameraMetadata) {
        groups.push({
          id: cameraID,
          content: cameraMetadata.title,
        });
      }
    });
    return new DataSet(groups);
  }

  protected _getPerfectWindowFromMediaStartAndEndTime(
    isEvent: boolean,
    startTime: Date | null,
    endTime: Date | null,
  ): TimelineWindow | null {
    if (isEvent) {
      const windowSeconds = this._getConfiguredWindowSeconds();

      if (startTime && endTime) {
        if (endTime.getTime() - startTime.getTime() > windowSeconds * 1000) {
          // If the event is larger than the configured window, only show the most
          // recent portion of the event that fits in the window.
          return {
            start: sub(endTime, { seconds: windowSeconds }),
            end: endTime,
          };
        } else {
          // If the event is shorter than the configured window, center the event
          // in the window.
          const gap = windowSeconds - (endTime.getTime() - startTime.getTime()) / 1000;
          return {
            start: sub(startTime, { seconds: gap / 2 }),
            end: add(endTime, { seconds: gap / 2 }),
          };
        }
      } else if (startTime) {
        // If there's no end-time yet, place the start-time in the center of the
        // time window.
        return {
          start: sub(startTime, { seconds: windowSeconds / 2 }),
          end: add(startTime, { seconds: windowSeconds / 2 }),
        };
      }
    } else if (startTime && endTime) {
      return {
        start: startTime,
        end: endTime,
      };
    }
    return null;
  }

  /**
   * Get the configured window length in seconds.
   */
  protected _getConfiguredWindowSeconds(): number {
    return this.timelineConfig?.window_seconds ?? configDefaults.timeline.window_seconds;
  }

  /**
   * Get desired timeline start/end time.
   * @returns A tuple of start/end date.
   */
  protected _getDefaultStartEnd(): TimelineWindow {
    const end = new Date();
    const start = sub(end, {
      seconds: this._getConfiguredWindowSeconds(),
    });
    return { start: start, end: end };
  }

  /**
   * Determine if the timeline should use clustering.
   * @returns `true` if the timeline should cluster, `false` otherwise.
   */
  protected _isClustering(): boolean {
    return (
      this.timelineConfig?.style === 'stack' &&
      !!this.timelineConfig?.clustering_threshold &&
      this.timelineConfig.clustering_threshold > 0
    );
  }

  protected _getDateTimeFormat(): TimelineFormatOption {
    const format24Hour = !!this.timelineConfig?.format?.['24h'];

    // See: https://visjs.github.io/vis-timeline/docs/timeline/#Configuration_Options
    return {
      minorLabels: {
        minute: format24Hour ? 'HH:mm' : 'h:mm A',
        hour: format24Hour ? 'HH:mm' : 'h:mm A',
      },
      majorLabels: {
        millisecond: format24Hour ? 'HH:mm:ss' : 'h:mm:ss A',
        second: format24Hour ? 'D MMMM HH:mm' : 'D MMMM h:mm A',
      },
    };
  }

  /**
   * Get timeline options.
   */
  protected _getOptions(): TimelineOptions | null {
    if (!this.timelineConfig) {
      return null;
    }

    const defaultWindow = this._getDefaultStartEnd();
    const stack = this.timelineConfig.style === 'stack';
    // Configuration for the Timeline, see:
    // https://visjs.github.io/vis-timeline/docs/timeline/#Configuration_Options
    return {
      cluster: this._isClustering()
        ? {
            // It would be better to automatically calculate `maxItems` from the
            // rendered height of the timeline (or group within the timeline) so
            // as to not waste vertical space (e.g. after the user changes to
            // fullscreen mode). Unfortunately this is not easy to do, as we
            // don't know the height of the timeline until after it renders --
            // and if we adjust `maxItems` then we can get into an infinite
            // resize loop. Adjusting the `maxItems` of a timeline, after it's
            // created, also does not appear to work as expected.
            maxItems: this.timelineConfig.clustering_threshold,

            clusterCriteria: (first: TimelineItem, second: TimelineItem): boolean => {
              const selectedIDs = this._getAllSelectedMediaIDsFromView();
              const firstMedia = (<AdvancedCameraCardTimelineItem>first).media;
              const secondMedia = (<AdvancedCameraCardTimelineItem>second).media;

              // Never include the currently selected item in a cluster, and
              // never group different object types together (e.g. person and
              // car).
              return (
                first.type !== 'background' &&
                first.type === second.type &&
                !selectedIDs.includes(first.id) &&
                !selectedIDs.includes(second.id) &&
                !!firstMedia &&
                !!secondMedia &&
                ViewMediaClassifier.isEvent(firstMedia) &&
                ViewMediaClassifier.isEvent(secondMedia) &&
                firstMedia.isGroupableWith(secondMedia)
              );
            },
          }
        : // Timeline type information is incorrect requiring this 'as'.
          (false as unknown as TimelineOptionsCluster),
      minHeight: '100%',
      maxHeight: '100%',
      zoomMax: 1 * 24 * 60 * 60 * 1000,
      zoomMin: 1 * 1000,
      margin: {
        item: {
          // In ribbon mode, a 20px item is reduced to 6px, so need to add a
          // 14px margin to ensure items line up with subgroups.
          vertical: stack ? 10 : 24,
        },
      },
      selectable: true,
      stack: stack,
      start: defaultWindow.start,
      end: defaultWindow.end,
      groupHeightMode: 'auto',
      tooltip: {
        followMouse: true,
        overflowMethod: 'cap',
        template: this._getTooltip.bind(this),
      },
      format: this._getDateTimeFormat(),
      xss: {
        disabled: false,
        filterOptions: {
          whiteList: {
            'advanced-camera-card-timeline-thumbnail': ['details', 'item'],
            div: ['title'],
            span: ['style'],
          },
        },
      },
    };
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

  protected _getAllSelectedMediaIDsFromView(): IdType[] {
    const view = this.viewManagerEpoch?.manager.getView();
    return (
      view?.queryResults?.getMultipleSelectedResults({
        main: true,
        ...(view.isGrid() && { allCameras: true }),
      }) ?? []
    )
      .filter((media) => ViewMediaClassifier.isEvent(media))
      .map((media) => media.getID())
      .filter(isTruthy);
  }

  /**
   * Update the timeline from the view object.
   */
  protected async _updateTimelineFromView(): Promise<void> {
    const view = this.viewManagerEpoch?.manager.getView();
    if (!view || !this.timelineConfig || !this._timelineSource || !this._timeline) {
      return;
    }

    const timelineWindow = this._timeline.getWindow();

    // Calculate the timeline window to show. If there is a window set in the
    // view context, always honor that. Otherwise, if there's a selected media
    // item that is already within the current window (even if it's not
    // perfectly positioned) -- leave it as is. Otherwise, change the window to
    // perfectly center on the media.

    let desiredWindow = timelineWindow;
    const media = view.queryResults?.getSelectedResult();
    const mediaStartTime = media?.getStartTime() ?? null;
    const mediaEndTime = media?.getEndTime() ?? null;
    const mediaIsEvent = media ? ViewMediaClassifier.isEvent(media) : false;

    const mediaWindow: TimelineWindow | null =
      media && mediaStartTime
        ? // If this media has no end time, it's just a "point" in time so the
          // range effectively starts/ends at the same time.
          { start: mediaStartTime, end: mediaEndTime ?? mediaStartTime }
        : null;
    const context = view.context?.timeline;

    if (context && context.window) {
      desiredWindow = context.window;
    } else if (mediaWindow && !rangesOverlap(mediaWindow, timelineWindow)) {
      const perfectMediaWindow = this._getPerfectWindowFromMediaStartAndEndTime(
        mediaIsEvent,
        mediaStartTime,
        mediaEndTime,
      );
      if (perfectMediaWindow) {
        desiredWindow = perfectMediaWindow;
      }
    }
    const prefetchedWindow = this._getPrefetchWindow(desiredWindow);

    if (!this._pointerHeld) {
      // Don't fetch any data or touch the timeline in any way if the user is
      // currently interacting with it. Without this the subsequent data fetches
      // (via fetchIfNecessary) may update the timeline contents which causes
      // the visjs timeline to stop dragging/panning operations which is very
      // disruptive to the user.
      await this._timelineSource?.refresh(prefetchedWindow);
    }

    const currentSelection = this._timeline.getSelection();
    const mediaIDsToSelect = this._getAllSelectedMediaIDsFromView();

    const needToSelect = mediaIDsToSelect.some(
      (mediaID) => !currentSelection.includes(mediaID),
    );

    if (needToSelect) {
      if (this._isClustering()) {
        // Hack: Clustering may not update unless the dataset changes, artifically
        // update the dataset to ensure the newly selected item cannot be included
        // in a cluster.

        for (const mediaID of mediaIDsToSelect) {
          // Need to this rewrite prior to setting the selection (just below), or
          // the selection will be lost on rewrite.
          this._timelineSource?.rewriteEvent(mediaID);
        }
      }

      this._timeline?.setSelection(mediaIDsToSelect, {
        focus: false,
        animation: {
          animation: false,
          zoom: false,
        },
      });
    }

    // Set the timeline window if necessary.
    if (!this._pointerHeld && !isEqual(desiredWindow, timelineWindow)) {
      this._timeline.setWindow(desiredWindow.start, desiredWindow.end);
    }

    // Only generate thumbnails if the existing query is not an acceptable
    // match, to avoid getting stuck in a loop (the subsequent fetches will not
    // actually fetch since the data will have been cached).
    //
    // Timeline receives a new `view`
    //  -> Events fetched
    //    -> Thumbnails generated
    //      -> New view dispatched (to load thumbnails into outer carousel).
    //  -> New view received ... [loop]
    //
    // Also don't generate thumbnails in mini-timelines (they will already have
    // been generated).

    const queryType = MediaQueriesClassifier.getQueriesType(view.query);
    if (!queryType) {
      return;
    }

    const freshMediaQuery = this._createMediaQueries(queryType, {
      window: desiredWindow,
    });

    if (
      !this.mini &&
      freshMediaQuery &&
      !this._alreadyHasAcceptableMediaQuery(freshMediaQuery)
    ) {
      const currentlySelectedResult = this.viewManagerEpoch?.manager
        .getView()
        ?.queryResults?.getSelectedResult();

      await this.viewManagerEpoch?.manager.setViewByParametersWithExistingQuery({
        params: {
          query: freshMediaQuery,
        },
        queryExecutorOptions: {
          selectResult: {
            id: currentlySelectedResult?.getID() ?? undefined,
          },
        },
        modifiers: [
          new MergeContextViewModifier(this._getTimelineContext(desiredWindow)),
        ],
      });
    }
  }

  protected _alreadyHasAcceptableMediaQuery(freshMediaQuery: MediaQueries): boolean {
    const view = this.viewManagerEpoch?.manager.getView();

    const currentQueries = view?.query?.getQueries();
    const currentResultTimestamp = view?.queryResults?.getResultsTimestamp();

    return (
      !!this.cameraManager &&
      !!currentQueries &&
      !!currentResultTimestamp &&
      !!view?.query?.isSupersetOf(freshMediaQuery) &&
      this.cameraManager.areMediaQueriesResultsFresh<MediaQuery>(
        currentQueries,
        currentResultTimestamp,
      )
    );
  }

  /**
   * Generate the context for timeline views.
   * @returns The TimelineViewContext object.
   */
  protected _getTimelineContext(window?: TimelineWindow): ViewContext {
    const view = this.viewManagerEpoch?.manager.getView();
    const newWindow = window ?? this._timeline?.getWindow();
    return {
      timeline: {
        ...view?.context?.timeline,
        ...(newWindow && { window: newWindow }),
      },
    };
  }

  /**
   * Called when an update will occur.
   * @param changedProps The changed properties
   */
  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('thumbnailConfig')) {
      if (this.thumbnailConfig) {
        this.style.setProperty(
          '--advanced-camera-card-thumbnail-size',
          `${this.thumbnailConfig.size}px`,
        );
      } else {
        this.style.removeProperty('--advanced-camera-card-thumbnail-size');
      }
    }

    if (changedProps.has('timelineConfig')) {
      setOrRemoveAttribute(this, !!this.timelineConfig?.show_recordings, 'recordings');
      setOrRemoveAttribute(this, this.timelineConfig?.style === 'ribbon', 'ribbon');
      setOrRemoveAttribute(this, this.timelineConfig?.style === 'stack', 'stack');
    }

    if (
      changedProps.has('cameraManager') ||
      changedProps.has('cameras') ||
      changedProps.has('timelineConfig') ||
      changedProps.has('cameraIDs')
    ) {
      if (this.cameraIDs?.size && this.cameraManager && this.timelineConfig) {
        this._timelineSource = new TimelineDataSource(
          this.cameraManager,
          this.cameraIDs,
          this.timelineConfig.events_media_type,
          this.timelineConfig.show_recordings,
        );
      } else {
        this._timelineSource = null;
      }
    }
  }

  /**
   * Destroy/reset the timeline.
   */
  protected _destroy(): void {
    this._timeline?.destroy();
    this._timeline = undefined;
    this._targetBarVisible = false;
    this._pointerHeld = null;
  }

  /**
   * Called when the component is updated.
   * @param changedProperties The changed properties if any.
   */
  protected updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);

    if (changedProperties.has('cameras') || changedProperties.has('cameraManager')) {
      this._destroy();
    }

    let createdTimeline = false;

    if (
      this._timelineSource &&
      this._refTimeline.value &&
      this.timelineConfig &&
      (!this._timeline ||
        changedProperties.has('timelineConfig') ||
        changedProperties.has('cameraIDs'))
    ) {
      if (this._timeline) {
        this._destroy();
      }

      const groups = this._getGroups();
      if (!groups.length) {
        return;
      }

      const options = this._getOptions();
      if (options) {
        createdTimeline = true;
        const noGroups = this.mini && groups.length === 1;
        if (noGroups) {
          this._timeline = new Timeline(
            this._refTimeline.value,
            this._timelineSource.dataset,
            options,
          ) as Timeline;
        } else {
          this._timeline = new Timeline(
            this._refTimeline.value,
            this._timelineSource.dataset,
            groups,
            options,
          ) as Timeline;
        }
        setOrRemoveAttribute(this, !noGroups, 'groups');

        this._timeline.on('rangechanged', this._timelineRangeChangedHandler.bind(this));
        this._timeline.on('click', this._timelineClickHandler.bind(this));
        this._timeline.on('rangechange', this._timelineRangeChangeHandler.bind(this));

        // This complexity exists to ensure we can tell between a click that
        // causes the timeline zoom/range to change, and a 'static' click on the
        // // timeline (which may need to trigger a card wide event).
        this._timeline.on('mouseDown', (ev: TimelineEventPropertiesResult) => {
          const window = this._timeline?.getWindow();
          this._pointerHeld = {
            ...ev,
            ...(window && { window: window }),
          };
          this._ignoreClick = false;
        });
        this._timeline.on('mouseUp', () => {
          this._pointerHeld = null;
          this._removeTargetBar();
        });
      }
    }

    if (createdTimeline) {
      // If the timeline was just created, give it one frame to draw itself.
      // Failure to do so may result in subsequent calls to
      // `this._timeline.setwindow()` being entirely ignored. Example case:
      // Clicking the timeline control on a recording thumbnail.
      window.requestAnimationFrame(this._updateTimelineFromView.bind(this));
    } else if (changedProperties.has('viewManagerEpoch')) {
      this._updateTimelineFromView();
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
