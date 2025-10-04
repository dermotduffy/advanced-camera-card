import { add, sub } from 'date-fns';
import { DataSet } from 'vis-data';
import { IdType, TimelineItem, TimelineWindow } from 'vis-timeline/esnext';
import { CameraManager } from '../../camera-manager/manager';
import {
  compressRanges,
  ExpiringMemoryRangeSet,
  MemoryRangeSet,
} from '../../camera-manager/range';
import {
  EventQuery,
  RecordingQuery,
  RecordingSegment,
} from '../../camera-manager/types';
import { capEndDate } from '../../camera-manager/utils/cap-end-date';
import { convertRangeToCacheFriendlyTimes } from '../../camera-manager/utils/range-to-cache-friendly';
import { FolderConfig } from '../../config/schema/folders';
import { ClipsOrSnapshotsOrAll } from '../../types';
import { errorToConsole, ModifyInterface } from '../../utils/basic.js';
import { ViewItem, ViewMedia } from '../../view/item';
import { ViewItemClassifier } from '../../view/item-classifier';
import { QueryClassifier } from '../../view/query-classifier';
import { View } from '../../view/view';
import { TimelineKey } from './types';

// Allow timeline freshness to be at least this number of seconds out of date
// (caching times in the data-engine may increase the effective delay).
const TIMELINE_FRESHNESS_TOLERANCE_SECONDS = 30;

// Number of seconds gap allowable in order to consider two recording segments
// to be consecutive. Some low performance cameras have trouble and without a
// generous allowance here the timeline may be littered with individual segments
// instead of clean recording blocks.
const TIMELINE_RECORDING_SEGMENT_CONSECUTIVE_TOLERANCE_SECONDS = 60;

export interface AdvancedCameraCardTimelineItem extends TimelineItem {
  // Use numbers to avoid significant volumes of Date object construction (for
  // high-quantity recording segments).
  start: number;
  end?: number;

  // DataSet requires string (not HTMLElement) content.
  content: string;

  media?: ViewMedia;
}

interface AdvancedCameraCardGroup {
  id: string;
  content: string;
}

export class TimelineDataSource {
  private _cameraManager: CameraManager;
  private _dataset: DataSet<AdvancedCameraCardTimelineItem> = new DataSet();
  private _groups: DataSet<AdvancedCameraCardGroup>;

  // The ranges in which recordings have been calculated and added for.
  // Calculating recordings is a very expensive process since it is based on
  // segments (not just the fetch is expensive, but the JS to dedup and turn the
  // high-N segments into a smaller number of consecutive recording blocks).
  private _recordingRanges = new MemoryRangeSet();

  // Cache event ranges since re-adding the same events is a timeline
  // performance killer (even if the request results are cached).
  private _eventRanges = new ExpiringMemoryRangeSet();

  private _cameraIDs: Set<string>;

  private _eventsMediaType: ClipsOrSnapshotsOrAll;
  private _showRecordings: boolean;

  constructor(
    cameraManager: CameraManager,
    keys: TimelineKey[],
    eventsMediaType: ClipsOrSnapshotsOrAll,
    showRecordings: boolean,
  ) {
    this._cameraManager = cameraManager;

    this._cameraIDs = new Set(
      keys.filter((key) => key.type === 'camera').map((key) => key.cameraID),
    );
    this._groups = this._generateGroups(keys);

    this._eventsMediaType = eventsMediaType;
    this._showRecordings = showRecordings;
  }

  get dataset(): DataSet<AdvancedCameraCardTimelineItem> {
    return this._dataset;
  }

  private _getGroupIDForCamera(cameraID: string): string {
    return `camera/${cameraID}`;
  }

  private _getGroupIDForFolder(folderConfig: FolderConfig): string {
    return folderConfig.id;
  }

  private _generateGroups(keys: TimelineKey[]): DataSet<AdvancedCameraCardGroup> {
    const groups: AdvancedCameraCardGroup[] = [];
    for (const key of keys) {
      /* istanbul ignore else: the else path cannot be reached as key can only
         be {camera, folder} -- @preserve */
      if (key.type === 'camera') {
        const cameraMetadata = this._cameraManager.getCameraMetadata(key.cameraID);

        groups.push({
          id: this._getGroupIDForCamera(key.cameraID),
          content: cameraMetadata?.title ?? key.cameraID,
        });
      } else if (key.type === 'folder') {
        const folderID = this._getGroupIDForFolder(key.folder);
        groups.push({
          id: folderID,
          content: key.folder.title ?? folderID,
        });
      }
    }
    return new DataSet(groups);
  }

  get groups(): DataSet<AdvancedCameraCardGroup> {
    return this._groups;
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

  public addEventMediaToDataset(mediaArray?: ViewItem[] | null): void {
    const data: AdvancedCameraCardTimelineItem[] = [];

    for (const media of mediaArray ?? []) {
      if (!ViewItemClassifier.isEvent(media)) {
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
        });
      }
    }

    this._dataset.update(data);
  }

  private _shouldUseEventsFromView(view?: View): boolean {
    return QueryClassifier.isEventQuery(view?.query);
  }

  private async _refreshEvents(window: TimelineWindow, view?: View): Promise<void> {
    if (this._shouldUseEventsFromView(view)) {
      return;
    }

    if (
      this._eventRanges.hasCoverage({
        start: window.start,
        end: sub(capEndDate(window.end), {
          seconds: TIMELINE_FRESHNESS_TOLERANCE_SECONDS,
        }),
      })
    ) {
      return;
    }
    const cacheFriendlyWindow = convertRangeToCacheFriendlyTimes(window);
    const eventQueries = this.getTimelineEventQueries(cacheFriendlyWindow);
    if (!eventQueries) {
      return;
    }

    this.addEventMediaToDataset(
      await this._cameraManager.executeMediaQueries(eventQueries),
    );

    this._eventRanges.add({
      ...cacheFriendlyWindow,
      expires: add(new Date(), { seconds: TIMELINE_FRESHNESS_TOLERANCE_SECONDS }),
    });
  }

  public async refresh(window: TimelineWindow, view?: View): Promise<void> {
    try {
      await Promise.all([
        this._refreshEvents(window, view),
        ...(this._showRecordings ? [this._refreshRecordings(window)] : []),
      ]);
    } catch (e) {
      errorToConsole(e as Error);

      // Intentionally ignore errors here, since it is likely the user will
      // change the range again and a subsequent call may work. To do otherwise
      // would be jarring to the timeline experience in the case of transient
      // errors from the backend.
    }
  }

  public getTimelineEventQueries(window: TimelineWindow): EventQuery[] | null {
    if (!this._cameraIDs.size) {
      return null;
    }
    return this._cameraManager.generateDefaultEventQueries(this._cameraIDs, {
      start: window.start,
      end: window.end,
      ...(this._eventsMediaType === 'clips' && { hasClip: true }),
      ...(this._eventsMediaType === 'snapshots' && { hasSnapshot: true }),
    });
  }

  public getTimelineRecordingQueries(window: TimelineWindow): RecordingQuery[] | null {
    if (!this._cameraIDs.size) {
      return null;
    }
    return this._cameraManager.generateDefaultRecordingQueries(this._cameraIDs, {
      start: window.start,
      end: window.end,
    });
  }

  private async _refreshRecordings(window: TimelineWindow): Promise<void> {
    if (!this._cameraIDs.size) {
      return;
    }

    type AdvancedCameraCardTimelineItemWithEnd = ModifyInterface<
      AdvancedCameraCardTimelineItem,
      { end: number }
    >;

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
      this._cameraIDs,
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
