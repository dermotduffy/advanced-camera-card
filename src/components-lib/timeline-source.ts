import { add, sub } from 'date-fns';
import { DataSet } from 'vis-data';
import { IdType, TimelineItem, TimelineWindow } from 'vis-timeline/esnext';
import { CameraManager } from '../camera-manager/manager';
import {
  compressRanges,
  ExpiringMemoryRangeSet,
  MemoryRangeSet,
} from '../camera-manager/range';
import { EventQuery, RecordingQuery, RecordingSegment } from '../camera-manager/types';
import { capEndDate } from '../camera-manager/utils/cap-end-date';
import { convertRangeToCacheFriendlyTimes } from '../camera-manager/utils/range-to-cache-friendly';
import { ClipsOrSnapshotsOrAll } from '../types';
import { errorToConsole, ModifyInterface } from '../utils/basic.js';
import { ViewMedia } from '../view/item';

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

export class TimelineDataSource {
  protected _cameraManager: CameraManager;
  protected _dataset: DataSet<AdvancedCameraCardTimelineItem> = new DataSet();

  // The ranges in which recordings have been calculated and added for.
  // Calculating recordings is a very expensive process since it is based on
  // segments (not just the fetch is expensive, but the JS to dedup and turn the
  // high-N segments into a smaller number of consecutive recording blocks).
  protected _recordingRanges = new MemoryRangeSet();

  // Cache event ranges since re-adding the same events is a timeline
  // performance killer (even if the request results are cached).
  protected _eventRanges = new ExpiringMemoryRangeSet();

  protected _cameraIDs: Set<string>;
  protected _eventsMediaType: ClipsOrSnapshotsOrAll;
  protected _showRecordings: boolean;

  constructor(
    cameraManager: CameraManager,
    cameraIDs: Set<string>,
    eventsMediaType: ClipsOrSnapshotsOrAll,
    showRecordings: boolean,
  ) {
    this._cameraManager = cameraManager;
    this._cameraIDs = cameraIDs;
    this._eventsMediaType = eventsMediaType;
    this._showRecordings = showRecordings;
  }

  get dataset(): DataSet<AdvancedCameraCardTimelineItem> {
    return this._dataset;
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

  public async refresh(window: TimelineWindow): Promise<void> {
    try {
      await Promise.all([
        this._refreshEvents(window),
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
    return this._cameraManager.generateDefaultEventQueries(this._cameraIDs, {
      start: window.start,
      end: window.end,
      ...(this._eventsMediaType === 'clips' && { hasClip: true }),
      ...(this._eventsMediaType === 'snapshots' && { hasSnapshot: true }),
    });
  }

  public getTimelineRecordingQueries(window: TimelineWindow): RecordingQuery[] | null {
    return this._cameraManager.generateDefaultRecordingQueries(this._cameraIDs, {
      start: window.start,
      end: window.end,
    });
  }

  protected async _refreshEvents(window: TimelineWindow): Promise<void> {
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

    const mediaArray = await this._cameraManager.executeMediaQueries(eventQueries);
    const data: AdvancedCameraCardTimelineItem[] = [];
    for (const media of mediaArray ?? []) {
      const startTime = media.getStartTime();
      const id = media.getID();
      const cameraID = media.getCameraID();
      if (id && startTime && cameraID) {
        data.push({
          id: id,
          group: cameraID,
          content: '',
          media: media,
          start: startTime.getTime(),
          type: 'range',
          end: media.getUsableEndTime()?.getTime() ?? startTime.getTime(),
        });
      }
    }
    this._dataset.update(data);

    this._eventRanges.add({
      ...cacheFriendlyWindow,
      expires: add(new Date(), { seconds: TIMELINE_FRESHNESS_TOLERANCE_SECONDS }),
    });
  }

  protected async _refreshRecordings(window: TimelineWindow): Promise<void> {
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
        group: cameraID,
        start: segment.start_time * 1000,
        end: segment.end_time * 1000,
        content: '',
        type: 'background',
      };
    };

    const getExistingRecordingsForCameraID = (
      cameraID: string,
    ): AdvancedCameraCardTimelineItemWithEnd[] => {
      return this._dataset.get({
        filter: (item) =>
          item.type == 'background' && item.group === cameraID && item.end !== undefined,
      }) as AdvancedCameraCardTimelineItemWithEnd[];
    };

    const deleteRecordingsForCameraID = (cameraID: string): void => {
      this._dataset.remove(
        this._dataset.get({
          filter: (item) => item.type === 'background' && item.group === cameraID,
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
