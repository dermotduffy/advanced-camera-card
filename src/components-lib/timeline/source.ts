import { add, sub } from 'date-fns';
import { DataSet } from 'vis-data';
import { IdType, TimelineItem, TimelineWindow } from 'vis-timeline/esnext';
import { CameraManager } from '../../camera-manager/manager';
import {
  compressRanges,
  ExpiringMemoryRangeSet,
  MemoryRangeSet,
} from '../../camera-manager/range';
import { RecordingSegment } from '../../camera-manager/types';
import { capEndDate } from '../../camera-manager/utils/cap-end-date';
import { convertRangeToCacheFriendlyTimes } from '../../camera-manager/utils/range-to-cache-friendly';
import { FoldersManager } from '../../card-controller/folders/manager';
import { ConditionStateManagerReadonlyInterface } from '../../conditions/types';
import { FolderConfig } from '../../config/schema/folders';
import { errorToConsole } from '../../utils/basic.js';
import { ViewItem, ViewMedia } from '../../view/item';
import { ViewItemClassifier } from '../../view/item-classifier';
import { UnifiedQuery } from '../../view/unified-query';
import { UnifiedQueryBuilder } from '../../view/unified-query-builder';
import { UnifiedQueryRunner } from '../../view/unified-query-runner';
import { UnifiedQueryTransformer } from '../../view/unified-query-transformer';

// Allow timeline freshness to be at least this number of seconds out of date
// (caching times in the data-engine may increase the effective delay).
const TIMELINE_FRESHNESS_TOLERANCE_SECONDS = 30;

// Number of seconds gap allowable in order to consider two recording segments
// to be consecutive. Some low performance cameras have trouble and without a
// generous allowance here the timeline may be littered with individual segments
// instead of clean recording blocks.
const TIMELINE_RECORDING_SEGMENT_CONSECUTIVE_TOLERANCE_SECONDS = 60;

export type AdvancedCameraCardTimelineItem = TimelineItem & {
  // Use numbers to avoid significant volumes of Date object construction (for
  // high-quantity recording segments).
  start: number;
  end?: number;

  // DataSet requires string (not HTMLElement) content.
  content: string;

  // Severity is duplicated here (also available via media.getSeverity())
  // because vis-timeline's dataAttributes option requires properties to exist
  // directly on the item object to render them as data-* HTML attributes for
  // CSS styling.
  severity?: string;
} & ( // Ensure that if there's a media item there is a query it is associated with.
    | {
        media: ViewMedia;
        query: UnifiedQuery;
      }
    | {
        media?: never;
        query?: never;
      }
  );

interface AdvancedCameraCardGroup {
  id: string;
  content: string;
}

export class TimelineDataSource {
  private _cameraManager: CameraManager;

  private _builder: UnifiedQueryBuilder;
  private _runner: UnifiedQueryRunner;

  private _dataset: DataSet<AdvancedCameraCardTimelineItem> = new DataSet();
  private _groups: DataSet<AdvancedCameraCardGroup>;

  // The ranges in which recordings have been calculated and added for.
  // Calculating recordings is a very expensive process since it is based on
  // segments (not just the fetch is expensive, but the JS to dedup and turn the
  // high-N segments into a smaller number of consecutive recording blocks).
  private _recordingRanges = new MemoryRangeSet();

  // Cache for all query results in this source instance.
  // Uses a single range set since shape determines content type.
  private _cache = new ExpiringMemoryRangeSet();

  private _showRecordings: boolean;

  // The "shape" of the query, a UnifiedQuery without time ranges. Determines
  // the groups/structure of the timeline.
  private _shape: UnifiedQuery;

  constructor(
    cameraManager: CameraManager,
    foldersManager: FoldersManager,
    conditionStateManager: ConditionStateManagerReadonlyInterface,
    shape: UnifiedQuery,
    showRecordings: boolean,
  ) {
    this._cameraManager = cameraManager;
    this._builder = new UnifiedQueryBuilder(cameraManager, foldersManager);
    this._runner = new UnifiedQueryRunner(
      cameraManager,
      foldersManager,
      conditionStateManager,
    );
    this._shape = shape;
    this._showRecordings = showRecordings;

    this._groups = this._generateGroups();
  }

  get dataset(): DataSet<AdvancedCameraCardTimelineItem> {
    return this._dataset;
  }

  get groups(): DataSet<AdvancedCameraCardGroup> {
    return this._groups;
  }

  get shape(): UnifiedQuery {
    return this._shape;
  }

  public areResultsFresh(resultsTimestamp: Date, query: UnifiedQuery): boolean {
    return this._runner.areResultsFresh(resultsTimestamp, query);
  }

  private _getGroupIDForCamera(cameraID: string): string {
    return `camera/${cameraID}`;
  }

  private _getGroupIDForFolder(folderConfig: FolderConfig): string {
    return `folder/${folderConfig.id}`;
  }

  private _generateGroups(): DataSet<AdvancedCameraCardGroup> {
    const groups: AdvancedCameraCardGroup[] = [];

    // Add folder-based groups
    const folderQueries = this._shape.getFolderQueries();
    for (const folderQuery of folderQueries) {
      const folderID = this._getGroupIDForFolder(folderQuery.folder);
      groups.push({
        id: folderID,
        content: folderQuery.folder.title ?? folderID,
      });
    }

    // Add camera-based groups
    const cameraIDs = this._shape.getAllCameraIDs();
    cameraIDs.forEach((cameraID) => {
      const cameraMetadata = this._cameraManager.getCameraMetadata(cameraID);
      groups.push({
        id: this._getGroupIDForCamera(cameraID),
        content: cameraMetadata?.title ?? cameraID,
      });
    });

    return new DataSet(groups);
  }

  public rewriteEvent(id: IdType): void {
    // Hack: For timeline uses of the event dataset clustering may not update
    // unless the dataset changes, artifically update the dataset to ensure the
    // newly selected item cannot be included in a cluster.

    // Hack2: Cannot use `updateOnly` here, as vis-data loses the object
    // prototype, see: https://github.com/visjs/vis-data/issues/997 . Instead,
    // remove then add.
    const item = this._dataset.get(id);
    if (item) {
      this._dataset.remove(id);
      this._dataset.add(item);
    }
  }

  public addMediaToDataset(query: UnifiedQuery, mediaArray?: ViewItem[] | null): void {
    const data: AdvancedCameraCardTimelineItem[] = [];

    for (const media of mediaArray ?? []) {
      if (!ViewItemClassifier.isEvent(media) && !ViewItemClassifier.isReview(media)) {
        continue;
      }

      const startTime = media.getStartTime();
      const id = media.getID();
      const folder = media.getFolder();
      const cameraID = media.getCameraID();
      const groupID = folder
        ? this._getGroupIDForFolder(folder)
        : cameraID
          ? this._getGroupIDForCamera(cameraID)
          : null;
      if (id && startTime && groupID) {
        data.push({
          id: id,
          group: groupID,
          content: '',
          media: media,
          start: startTime.getTime(),
          type: 'range',
          end: media.getUsableEndTime()?.getTime(),
          ...(ViewItemClassifier.isReview(media) && {
            severity: media.getSeverity() ?? undefined,
          }),
          query,
        });
      }
    }

    this._dataset.update(data);
  }

  public buildRecordingsWindowedQuery(window: TimelineWindow): UnifiedQuery | null {
    return this._builder.buildRecordingsQuery(this._shape.getAllCameraIDs(), {
      start: window.start,
      end: window.end,
    });
  }

  private async _refreshQuery(window: TimelineWindow): Promise<void> {
    const cacheFriendlyWindow = convertRangeToCacheFriendlyTimes(window);

    if (
      this._cache.hasCoverage({
        start: cacheFriendlyWindow.start,
        end: sub(capEndDate(cacheFriendlyWindow.end), {
          seconds: TIMELINE_FRESHNESS_TOLERANCE_SECONDS,
        }),
      })
    ) {
      return;
    }

    const query = UnifiedQueryTransformer.rebuildQuery(this._shape, {
      start: cacheFriendlyWindow.start,
      end: cacheFriendlyWindow.end,
    });

    this.addMediaToDataset(query, await this._runner.execute(query));
    this._cache.add({
      ...cacheFriendlyWindow,
      expires: add(new Date(), { seconds: TIMELINE_FRESHNESS_TOLERANCE_SECONDS }),
    });
  }

  public async refresh(window: TimelineWindow): Promise<void> {
    try {
      await Promise.all([
        this._refreshQuery(window),
        ...(this._showRecordings ? [this._refreshRecordings(window)] : []),
      ]);
    } catch (e) {
      errorToConsole(e as Error);
    }
  }

  private async _refreshRecordings(window: TimelineWindow): Promise<void> {
    // Recordings only apply to camera-based shapes
    const cameraIDs = this._shape.getAllCameraIDs();
    if (!cameraIDs?.size) {
      return;
    }

    type AdvancedCameraCardTimelineItemWithEnd = AdvancedCameraCardTimelineItem & {
      end: number;
    };

    const convertSegmentToRecording = (
      cameraID: string,
      segment: RecordingSegment,
    ): AdvancedCameraCardTimelineItemWithEnd => {
      return {
        id: `recording-${cameraID}-${segment.id}`,
        group: this._getGroupIDForCamera(cameraID),
        start: segment.start_time * 1000,
        end: segment.end_time * 1000,
        content: '',
        type: 'background',
      };
    };

    const getExistingRecordingsForCameraID = (
      cameraID: string,
    ): AdvancedCameraCardTimelineItemWithEnd[] => {
      const groupID = this._getGroupIDForCamera(cameraID);
      return this._dataset.get({
        filter: (item) =>
          item.type === 'background' && item.group === groupID && item.end !== undefined,
      }) as AdvancedCameraCardTimelineItemWithEnd[];
    };

    const deleteRecordingsForCameraID = (cameraID: string): void => {
      const groupID = this._getGroupIDForCamera(cameraID);
      this._dataset.remove(
        this._dataset.get({
          filter: (item) => item.type === 'background' && item.group === groupID,
        }),
      );
    };

    const addRecordings = (
      recordings: AdvancedCameraCardTimelineItemWithEnd[],
    ): void => {
      this._dataset.add(recordings);
    };

    // Calculate an end date that's slightly short of the current time to allow
    // for caching up to the freshness tolerance.
    if (
      this._recordingRanges.hasCoverage({
        start: window.start,
        end: sub(capEndDate(window.end), {
          seconds: TIMELINE_FRESHNESS_TOLERANCE_SECONDS,
        }),
      })
    ) {
      return;
    }

    const cacheFriendlyWindow = convertRangeToCacheFriendlyTimes(window);
    const recordingQueries = this._cameraManager.generateDefaultRecordingSegmentsQueries(
      cameraIDs,
      {
        start: cacheFriendlyWindow.start,
        end: cacheFriendlyWindow.end,
      },
    );

    if (!recordingQueries) {
      return;
    }
    const results = await this._cameraManager.getRecordingSegments(recordingQueries);

    const newSegments: Map<string, RecordingSegment[]> = new Map();
    for (const [query, result] of results) {
      for (const cameraID of query.cameraIDs) {
        let destination: RecordingSegment[] | undefined = newSegments.get(cameraID);
        if (!destination) {
          destination = [];
          newSegments.set(cameraID, destination);
        }
        result.segments.forEach((segment) => destination?.push(segment));
      }
    }

    for (const [cameraID, segments] of newSegments.entries()) {
      const existingRecordings = getExistingRecordingsForCameraID(cameraID);
      const mergedRecordings = existingRecordings.concat(
        segments.map((segment) => convertSegmentToRecording(cameraID, segment)),
      );
      const compressedRecordings = compressRanges(
        mergedRecordings,
        TIMELINE_RECORDING_SEGMENT_CONSECUTIVE_TOLERANCE_SECONDS,
      ) as AdvancedCameraCardTimelineItemWithEnd[];

      deleteRecordingsForCameraID(cameraID);
      addRecordings(compressedRecordings);
    }

    this._recordingRanges.add({
      start: cacheFriendlyWindow.start,
      end: cacheFriendlyWindow.end,
    });
  }
}
