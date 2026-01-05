import { add, differenceInSeconds, sub } from 'date-fns';
import { LitElement } from 'lit';
import { isEqual, throttle } from 'lodash-es';
import { ViewContext } from 'view';
import {
  IdType,
  Timeline,
  TimelineEventPropertiesResult,
  TimelineFormatOption,
  TimelineItem,
  TimelineOptions,
  TimelineOptionsCluster,
  TimelineWindow,
} from 'vis-timeline';
import { CameraManager } from '../../camera-manager/manager';
import { rangesOverlap } from '../../camera-manager/range';
import { convertRangeToCacheFriendlyTimes } from '../../camera-manager/utils/range-to-cache-friendly';
import { FoldersManager } from '../../card-controller/folders/manager';
import { ViewItemManager } from '../../card-controller/view/item-manager';
import { MergeContextViewModifier } from '../../card-controller/view/modifiers/merge-context';
import { ViewManagerEpoch } from '../../card-controller/view/types';
import { ConditionStateManagerReadonlyInterface } from '../../conditions/types';
import { CameraConfig } from '../../config/schema/cameras';
import { AdvancedCameraCardView } from '../../config/schema/common/const';
import { ThumbnailsControlBaseConfig } from '../../config/schema/common/controls/thumbnails';
import {
  TimelineCoreConfig,
  TimelinePanMode,
} from '../../config/schema/common/controls/timeline';
import { configDefaults } from '../../config/schema/types';
import { HomeAssistant } from '../../ha/types';
import { stopEventFromActivatingCardWideActions } from '../../utils/action';
import {
  formatDateAndTime,
  isHoverableDevice,
  isTruthy,
  setOrRemoveAttribute,
} from '../../utils/basic';
import { findBestMediaTimeIndex } from '../../utils/find-best-media-time-index';
import { fireAdvancedCameraCardEvent } from '../../utils/fire-advanced-camera-card-event';
import { ViewMedia } from '../../view/item';
import { ViewItemClassifier } from '../../view/item-classifier';
import { QueryResults } from '../../view/query-results';
import { UnifiedQuery } from '../../view/unified-query';
import { UnifiedQueryTransformer } from '../../view/unified-query-builder';
import { mergeViewContext } from '../../view/view';
import { AdvancedCameraCardTimelineItem, TimelineDataSource } from './source';
import { ExtendedTimeline, TimelineItemClickAction, TimelineRangeChange } from './types';

// An event used to fetch data required for thumbnail rendering. See special
// note below on why this is necessary.
interface ThumbnailDataRequest {
  item: IdType;
  hass?: HomeAssistant;
  cameraManager?: CameraManager;
  cameraConfig?: CameraConfig;
  media?: ViewMedia;
  viewManagerEpoch?: ViewManagerEpoch;
  viewItemManager?: ViewItemManager;
}

class ThumbnailDataRequestEvent extends CustomEvent<ThumbnailDataRequest> {}

interface TimelineControllerOptions {
  hass?: HomeAssistant;
  cameraManager?: CameraManager;
  conditionStateManager?: ConditionStateManagerReadonlyInterface;
  foldersManager?: FoldersManager;
  viewItemManager?: ViewItemManager;
  timelineConfig?: TimelineCoreConfig;
  mini?: boolean;
  thumbnailConfig?: ThumbnailsControlBaseConfig;
  query?: UnifiedQuery;
}

const TIMELINE_TARGET_BAR_ID = 'target_bar';

export class TimelineController {
  private _host: LitElement;
  private _timelineElement: HTMLElement | null = null;

  private _source: TimelineDataSource | null = null;
  private _timeline: ExtendedTimeline | null = null;

  private _hass: HomeAssistant | null = null;
  private _cameraManager: CameraManager | null = null;
  private _viewItemManager: ViewItemManager | null = null;
  private _viewManagerEpoch: ViewManagerEpoch | null = null;
  private _timelineConfig: TimelineCoreConfig | null = null;
  private _mini = false;

  private _panMode: TimelinePanMode | null = null;
  private _targetBarVisible = false;
  private _itemClickAction: TimelineItemClickAction = 'play';

  private _thumbnailConfig: ThumbnailsControlBaseConfig | null = null;

  private readonly _isHoverableDevice = isHoverableDevice();

  // Range changes are volumonous: throttle the calls on seeking.
  private _throttledSetViewDuringRangeChange = throttle(
    this._setViewDuringRangeChange.bind(this),
    1000 / 10,
  );

  // Need a way to separate when a user clicks (to pan the timeline) vs when a
  // user clicks (to choose a recording (non-event) to play).
  private _pointerHeld:
    | (TimelineEventPropertiesResult & { window?: TimelineWindow })
    | null = null;
  private _ignoreClick = false;

  constructor(host: LitElement) {
    this._host = host;
  }

  public setHass(hass: HomeAssistant | null): void {
    this._hass = hass;
  }

  public destroyTimeline(): void {
    this._timeline?.destroy();
    this._timeline = null;
    this._targetBarVisible = false;
    this._pointerHeld = null;
  }

  /**
   * Extract the "shape" of a query - a clone without time ranges.
   * Shape determines timeline structure (groups).
   */
  private _getQueryShape(query: UnifiedQuery): UnifiedQuery {
    return UnifiedQueryTransformer.stripTimeRange(query);
  }

  private _hasSameShape(a?: UnifiedQuery | null, b?: UnifiedQuery | null): boolean {
    if (!a && !b) {
      return true;
    }
    if (!a || !b) {
      return false;
    }
    return a.isEqual(b);
  }

  public setOptions(options: TimelineControllerOptions): void {
    // Extract the shape (query without time ranges) for comparison.
    const newShape = options.query ? this._getQueryShape(options.query) : null;

    // Rebuild source if config, dependencies, or shape changed.
    const needsRebuild =
      !this._source ||
      this._cameraManager !== (options.cameraManager ?? null) ||
      !isEqual(this._timelineConfig, options.timelineConfig ?? null) ||
      !this._hasSameShape(this._source?.shape, newShape);

    if (needsRebuild) {
      this.destroyTimeline();

      if (
        newShape &&
        options.cameraManager &&
        options.foldersManager &&
        options.conditionStateManager &&
        options.timelineConfig
      ) {
        this._source = new TimelineDataSource(
          options.cameraManager,
          options.foldersManager,
          options.conditionStateManager,
          newShape,
          options.timelineConfig.show_recordings,
        );
      } else {
        this._source = null;
      }
    }

    if (this._thumbnailConfig !== (options.thumbnailConfig ?? null)) {
      if (options.thumbnailConfig) {
        this._host.style.setProperty(
          '--advanced-camera-card-thumbnail-size',
          `${options?.thumbnailConfig.size}px`,
        );
      } else {
        this._host.style.removeProperty('--advanced-camera-card-thumbnail-size');
      }
    }

    if (this._timelineConfig !== (options.timelineConfig ?? null)) {
      this._timelineConfig = options?.timelineConfig ?? null;

      setOrRemoveAttribute(
        this._host,
        !!this._timelineConfig?.show_recordings,
        'recordings',
      );
      setOrRemoveAttribute(
        this._host,
        this._timelineConfig?.style === 'ribbon',
        'ribbon',
      );
      setOrRemoveAttribute(this._host, this._timelineConfig?.style === 'stack', 'stack');
    }

    this._thumbnailConfig = options?.thumbnailConfig ?? null;
    this._cameraManager = options?.cameraManager ?? null;
    this._viewItemManager = options?.viewItemManager ?? null;
    this._timelineConfig = options?.timelineConfig ?? null;
    this._mini = options?.mini ?? false;

    setOrRemoveAttribute(this._host, this._shouldShowGroups(), 'groups');
  }

  public async setView(viewManagerEpoch: ViewManagerEpoch | null): Promise<void> {
    if (this._viewManagerEpoch === viewManagerEpoch) {
      return;
    }

    this._viewManagerEpoch = viewManagerEpoch ?? null;
    await this._updateTimelineFromView();
  }

  public handleThumbnailDataRequest = (request: ThumbnailDataRequestEvent): void => {
    const itemID = request.detail.item;
    const media = this._source?.dataset.get(itemID)?.media;
    const cameraConfig = media
      ? this._cameraManager?.getStore().getCameraConfigForMedia(media) ?? undefined
      : undefined;

    request.detail.hass = this._hass ?? undefined;
    request.detail.cameraConfig = cameraConfig;
    request.detail.cameraManager = this._cameraManager ?? undefined;
    request.detail.viewItemManager = this._viewItemManager ?? undefined;
    request.detail.media = media;
    request.detail.viewManagerEpoch = this._viewManagerEpoch ?? undefined;
  };

  public getEffectivePanMode(): TimelinePanMode {
    return this._panMode ?? this._timelineConfig?.pan_mode ?? 'pan';
  }

  public cyclePanMode(): void {
    const panMode = this.getEffectivePanMode();
    this._panMode =
      panMode === 'pan'
        ? 'seek'
        : panMode === 'seek'
          ? 'seek-in-media'
          : panMode === 'seek-in-media'
            ? 'seek-in-camera'
            : 'pan';
    this._host.requestUpdate();
  }

  public setTimelineDate(date: Date): void {
    this._timeline?.moveTo(date);
  }

  public shouldSupportSeeking(): boolean {
    return this._mini;
  }

  public setTimelineElement(element?: HTMLElement): boolean {
    if (
      !this._source ||
      !this._timelineConfig ||
      (this._timeline && this._timelineElement === (element ?? null))
    ) {
      return false;
    }

    this.destroyTimeline();
    this._timelineElement = element ?? null;

    if (!this._timelineElement) {
      return false;
    }

    const options = this._getOptions();
    if (!options) {
      return false;
    }

    if (this._shouldShowGroups()) {
      this._timeline = new Timeline(
        this._timelineElement,
        this._source.dataset,
        this._source.groups,
        options,
      );
    } else {
      this._timeline = new Timeline(
        this._timelineElement,
        this._source.dataset,
        options,
      );
    }

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

    return true;
  }

  private _shouldShowGroups(): boolean {
    return !this._mini || (this._source?.groups.length ?? 0) > 1;
  }

  private _setTargetBarAppropriately(targetTime: Date): void {
    if (!this._timeline) {
      return;
    }

    const view = this._viewManagerEpoch?.manager.getView();
    const panMode = this.getEffectivePanMode();
    const targetBarOn =
      this.shouldSupportSeeking() &&
      (panMode === 'seek' ||
        ((panMode === 'seek-in-camera' || panMode === 'seek-in-media') &&
          this._timeline.getSelection().some((id) => {
            const item = this._source?.dataset?.get(id);
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
      this._host.setAttribute(
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

  private _removeTargetBar(): void {
    this._host.removeAttribute('target-bar-direction');
    if (this._targetBarVisible) {
      this._timeline?.removeCustomTime(TIMELINE_TARGET_BAR_ID);
      this._targetBarVisible = false;
    }
  }

  /**
   * Called whenever the range is in the process of being changed.
   * @param properties
   */
  private _timelineRangeChangeHandler(properties: TimelineRangeChange): void {
    if (this._pointerHeld) {
      this._ignoreClick = true;
    }

    if (
      this.shouldSupportSeeking() &&
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

  private async _setViewDuringRangeChange(
    targetTime: Date,
    properties: TimelineRangeChange,
  ): Promise<void> {
    const view = this._viewManagerEpoch?.manager.getView();
    const results = view?.queryResults;
    const media = results?.getResults();
    const panMode = this.getEffectivePanMode();
    if (
      !media ||
      !results ||
      !this._timeline ||
      !view ||
      !this._hass ||
      !this._cameraManager ||
      panMode === 'pan'
    ) {
      return;
    }

    const canSeek = this.shouldSupportSeeking();
    let newResults: QueryResults | null = null;

    if (panMode === 'seek') {
      newResults = results
        .clone()
        .selectBestResult(
          (mediaArray) => findBestMediaTimeIndex(mediaArray, targetTime, view?.camera),
          {
            allCameras: true,
            main: true,
          },
        );
    } else if (panMode === 'seek-in-camera') {
      newResults = results
        .clone()
        .selectBestResult(
          (mediaArray) => findBestMediaTimeIndex(mediaArray, targetTime),
          {
            cameraID: view.camera,
          },
        )
        .promoteCameraSelectionToMainSelection(view.camera);
    } else if (panMode === 'seek-in-media') {
      newResults = results;
    }

    const desiredView: AdvancedCameraCardView = this._mini
      ? targetTime >= new Date()
        ? 'live'
        : 'media'
      : view.view;

    const selectedItem = newResults?.getSelectedResult();
    const selectedCamera = ViewItemClassifier.isMedia(selectedItem)
      ? selectedItem.getCameraID()
      : null;

    this._viewManagerEpoch?.manager.setViewByParameters({
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

  private _getTimelineContext(window?: TimelineWindow): ViewContext {
    const view = this._viewManagerEpoch?.manager.getView();
    const newWindow = window ?? this._timeline?.getWindow();
    return {
      timeline: {
        ...view?.context?.timeline,
        ...(newWindow && { window: newWindow }),
      },
    };
  }

  private async _timelineClickHandler(
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

    const view = this._viewManagerEpoch?.manager.getView();
    const id = String(properties.item);
    const item = this._source?.dataset.get(id) ?? null;

    if (
      this._ignoreClick ||
      !view ||
      !this._viewManagerEpoch ||
      !this._source ||
      !properties.what ||
      !item
    ) {
      return;
    }

    let drawerAction: 'open' | 'close' = 'close';

    if (
      this._timelineConfig?.show_recordings &&
      properties.time &&
      ['background', 'axis'].includes(properties.what) &&
      this._source &&
      this._timeline
    ) {
      const query = this._source.buildRecordingsWindowedQuery(
        convertRangeToCacheFriendlyTimes(
          this._getPrefetchWindow(this._timeline.getWindow()),
        ),
      );
      if (query) {
        await this._viewManagerEpoch?.manager.setViewByParametersWithExistingQuery({
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

      const criteria = {
        main: true,
        ...(cameraID && view.isGrid() && { cameraID: cameraID }),
      };
      const newResults = view.queryResults
        ?.clone()
        .resetSelectedResult()
        .selectResultIfFound((media) => media.getID() === id, criteria);
      const selectedItem = newResults?.getSelectedResult();
      const context: ViewContext = mergeViewContext(this._getTimelineContext(), {
        ...(ViewItemClassifier.isEvent(selectedItem) &&
          // Only attempt to seek if the event has a real end time, otherwise
          // the viewer cannot actually seek there and shows the unseekable
          // message.
          selectedItem.getEndTime() && { mediaViewer: { seek: properties.time } }),
      });

      if (!newResults || !newResults.hasSelectedResult()) {
        // This can happen in a few situations:
        // - If this is a recording query (with recorded hours) and an event is
        //   clicked on the timeline
        // - If the current thumbnails/results is a filtered view from the media
        //   gallery (i.e. any case where the thumbnails may not be match the
        //   events on the timeline, e.g. in the snapshots viewer but
        //   mini-timeline showing all media).
        // - If a folder media was loaded into the timeline from a prior folder
        //   query other than the one stored in the view (e.g. user navigated to
        //   a different folder in the thumbnails carousel).
        const queryResults = this._buildQueryResultsFromExistingItem(item);
        if (item && item.query && queryResults) {
          this._viewManagerEpoch?.manager.setViewByParameters({
            params: {
              view: 'media',
              query: item.query,
              queryResults,
            },
            modifiers: [new MergeContextViewModifier(context)],
          });
        }
      } else {
        this._viewManagerEpoch.manager.setViewByParameters({
          params: {
            queryResults: newResults,
            view: this._itemClickAction === 'play' ? 'media' : view.view,
          },
          modifiers: [new MergeContextViewModifier(context)],
        });
      }

      if (this._itemClickAction === 'select') {
        drawerAction = 'open';
      }
    }

    fireAdvancedCameraCardEvent(this._host, `thumbnails:${drawerAction}`);

    this._ignoreClick = false;
  }

  private _buildQueryResultsFromExistingItem(
    item: AdvancedCameraCardTimelineItem,
  ): QueryResults | null {
    const query = item.query;
    if (!query || !this._source) {
      return null;
    }
    const media = this._source.dataset
      .get({
        filter: (timelineItem) => !!timelineItem.query && query === timelineItem.query,
      })
      .map((timelineItem) => timelineItem.media)
      .filter(isTruthy);
    const selectedIndex = media.findIndex((m) => m.getID() === item.id);
    return selectedIndex >= 0
      ? new QueryResults({ results: media, selectedIndex })
      : null;
  }

  /**
   * Get a broader prefetch window from a start and end basis.
   * @param window The window to broaden.
   * @returns A broader timeline.
   */
  private _getPrefetchWindow(window: TimelineWindow): TimelineWindow {
    const delta = differenceInSeconds(window.end, window.start);
    return {
      start: sub(window.start, { seconds: delta }),
      end: add(window.end, { seconds: delta }),
    };
  }

  /**
   * Apply a cache-friendly prefetch window to all media queries.
   */
  private _applyWindowToQuery(
    query: UnifiedQuery,
    window: TimelineWindow,
  ): UnifiedQuery {
    const prefetchWindow = this._getPrefetchWindow(window);
    const cacheFriendlyWindow = convertRangeToCacheFriendlyTimes(prefetchWindow);
    return UnifiedQueryTransformer.rebuildQuery(query, {
      start: cacheFriendlyWindow.start,
      end: cacheFriendlyWindow.end,
    });
  }

  private _timelineRangeChangedHandler = async (properties: {
    start: Date;
    end: Date;
    byUser: boolean;
    event: Event & { additionalEvent: string };
  }): Promise<void> => {
    this._removeTargetBar();
    const view = this._viewManagerEpoch?.manager.getView();

    if (
      !this._timeline ||
      !view ||
      // When in mini mode, something else is in charge of the primary media
      // population (e.g. the live view), in this case only act when the user
      // themselves are interacting with the timeline.
      (this._mini && !properties.byUser)
    ) {
      return;
    }

    await this._source?.refresh(this._getPrefetchWindow(properties));

    if (!view.query) {
      return;
    }
    const query = this._applyWindowToQuery(view.query, properties);

    if (this._alreadyHasAcceptableMediaQuery(query)) {
      return;
    }

    await this._viewManagerEpoch?.manager.setViewByParametersWithExistingQuery({
      params: {
        query,
      },
      queryExecutorOptions: {
        selectResult: {
          id:
            this._viewManagerEpoch?.manager
              .getView()
              ?.queryResults?.getSelectedResult()
              ?.getID() ?? undefined,
        },
      },
      modifiers: [new MergeContextViewModifier(this._getTimelineContext())],
    });
  };

  private _alreadyHasAcceptableMediaQuery(freshQuery: UnifiedQuery): boolean {
    const view = this._viewManagerEpoch?.manager.getView();
    const query = view?.query;

    if (!this._source || !query) {
      return false;
    }

    const currentResultTimestamp = view?.queryResults?.getResultsTimestamp();
    if (!currentResultTimestamp) {
      return false;
    }

    return (
      query.isSupersetOf(freshQuery) &&
      this._source.areResultsFresh(currentResultTimestamp, query)
    );
  }

  private async _updateTimelineFromView(): Promise<void> {
    const view = this._viewManagerEpoch?.manager.getView();
    if (!view || !this._timelineConfig || !this._source || !this._timeline) {
      return;
    }

    const timelineWindow = this._timeline.getWindow();

    // Calculate the timeline window to show. If there is a window set in the
    // view context, always honor that. Otherwise, if there's a selected media
    // item that is already within the current window (even if it's not
    // perfectly positioned) -- leave it as is. Otherwise, change the window to
    // perfectly center on the media.

    let desiredWindow = timelineWindow;
    const item = view.queryResults?.getSelectedResult();
    const media = item && ViewItemClassifier.isMedia(item) ? item : null;
    const mediaStartTime = media?.getStartTime() ?? null;
    const mediaEndTime = media?.getEndTime() ?? null;
    const mediaIsEvent = media ? ViewItemClassifier.isEvent(media) : false;

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

    if (!this._pointerHeld && view.query) {
      // Don't fetch any data or touch the timeline in any way if the user is
      // currently interacting with it. Without this the subsequent data fetches
      // (via fetchIfNecessary) may update the timeline contents which causes
      // the visjs timeline to stop dragging/panning operations which is very
      // disruptive to the user.
      await this._source?.refresh(prefetchedWindow);
      this._source.addMediaToDataset(view.query, view.queryResults?.getResults());
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
          this._source?.rewriteEvent(mediaID);
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
    if (!view.query) {
      return;
    }

    const freshMediaQuery = this._applyWindowToQuery(view.query, desiredWindow);

    if (
      !this._mini &&
      freshMediaQuery &&
      !this._alreadyHasAcceptableMediaQuery(freshMediaQuery)
    ) {
      const currentlySelectedResult = this._viewManagerEpoch?.manager
        .getView()
        ?.queryResults?.getSelectedResult();

      await this._viewManagerEpoch?.manager.setViewByParametersWithExistingQuery({
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

  private _getAllSelectedMediaIDsFromView(): IdType[] {
    const view = this._viewManagerEpoch?.manager.getView();
    return (
      view?.queryResults?.getMultipleSelectedResults({
        main: true,
        ...(view.isGrid() && { allCameras: true }),
      }) ?? []
    )
      .filter((media) => ViewItemClassifier.isEvent(media))
      .map((media) => media.getID())
      .filter(isTruthy);
  }

  private _isClustering(): boolean {
    return (
      this._timelineConfig?.style === 'stack' &&
      !!this._timelineConfig?.clustering_threshold &&
      this._timelineConfig.clustering_threshold > 0
    );
  }

  private _getPerfectWindowFromMediaStartAndEndTime(
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

  private _getConfiguredWindowSeconds(): number {
    return (
      this._timelineConfig?.window_seconds ?? configDefaults.timeline.window_seconds
    );
  }

  /**
   * Get desired timeline start/end time.
   * @returns A tuple of start/end date.
   */
  private _getDefaultStartEnd(): TimelineWindow {
    const end = new Date();
    const start = sub(end, {
      seconds: this._getConfiguredWindowSeconds(),
    });
    return { start: start, end: end };
  }

  private _getDateTimeFormat(): TimelineFormatOption {
    const format24Hour = !!this._timelineConfig?.format?.['24h'];

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

  private _getOptions(): TimelineOptions | null {
    if (!this._timelineConfig) {
      return null;
    }

    const defaultWindow = this._getDefaultStartEnd();
    const stack = this._timelineConfig.style === 'stack';
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
            maxItems: this._timelineConfig.clustering_threshold,

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
                ViewItemClassifier.isEvent(firstMedia) &&
                ViewItemClassifier.isEvent(secondMedia) &&
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
   * Get a tooltip for a given timeline event.
   * @param item The TimelineItem in question.
   * @returns The tooltip as a string to render.
   */
  private _getTooltip(item: TimelineItem): string {
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
          ${this._thumbnailConfig?.show_details ? 'details' : ''}
        >
        </advanced-camera-card-timeline-thumbnail>`;
  }
}
