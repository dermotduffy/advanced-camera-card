import type { CameraConfig } from '../../config/schema/cameras';
import type { HomeAssistant } from '../../ha/types';
import { hasUnsupportedFilters, QuerySource } from '../../query-source';
import { createDayHourResolver, hourInTimeZoneToDate } from '../../utils/timezone';
import { ViewMedia, ViewMediaType } from '../../view/item';
import type { ViewItemCapabilities } from '../../view/types';
import type { Camera } from '../camera';
import { GenericCameraManagerEngine } from '../generic/engine-generic';
import type { CameraManagerReadOnlyConfigStore } from '../store';
import {
  Engine, QueryResultsType, QueryType,
  type EngineOptions, type PartialRecordingQuery, type PartialRecordingSegmentsQuery,
  type RecordingQuery, type RecordingQueryResults, type RecordingQueryResultsMap,
  type RecordingSegment, type RecordingSegmentsQuery, type RecordingSegmentsQueryResultsMap,
} from '../types';
import { getCameraEntityFromConfig } from '../utils/camera-entity-from-config';
import { DvrkitCamera } from './camera';

interface Summary {
  timezone: string;
  days: { day: string; hours: { hour: number; duration: number }[] }[];
}
interface NativeSegment {
  start_time: number;
  end_time: number;
  type: string;
}
interface Recording {
  cameraID: string;
  start: Date;
  end: Date;
  url: string;
}
interface Results extends RecordingQueryResults {
  recordings: Recording[];
}

export class DvrkitRecordingViewMedia extends ViewMedia {
  private readonly recording: Recording;
  constructor(recording: Recording) {
    super(ViewMediaType.Recording, { cameraID: recording.cameraID });
    this.recording = recording;
  }
  public override getID(): string { return `${this.recording.cameraID}/${this.recording.start.getTime()}`; }
  public override getStartTime(): Date { return this.recording.start; }
  public override getEndTime(): Date { return this.recording.end; }
  public override getContentID(): string { return this.recording.url; }
  public override getTitle(): string { return this.recording.start.toLocaleString(); }
}

export class DvrkitCameraManagerEngine extends GenericCameraManagerEngine {
  private readonly _summaries = new WeakMap<HomeAssistant, Map<string, Promise<Summary>>>();
  private readonly _intervals = new WeakMap<HomeAssistant, Map<string, Promise<NativeSegment[]>>>();

  private async _inFlight<T>(
    requests: WeakMap<HomeAssistant, Map<string, Promise<T>>>,
    hass: HomeAssistant,
    key: string,
    request: () => Promise<T>,
  ): Promise<T> {
    let pending = requests.get(hass);
    if (!pending) {
      pending = new Map();
      requests.set(hass, pending);
    }
    let promise = pending.get(key);
    if (!promise) {
      promise = request();
      pending.set(key, promise);
    }
    try {
      return await promise;
    } finally {
      if (pending.get(key) === promise) {
        pending.delete(key);
      }
    }
  }

  private _getSummary(hass: HomeAssistant, entityID: string): Promise<Summary> {
    return this._inFlight(this._summaries, hass, entityID, () =>
      hass.callWS<Summary>({ type: 'dvrkit/recordings/summary', entity_id: entityID }));
  }

  private _getInterval(
    hass: HomeAssistant, entityID: string, after: number, before: number,
  ): Promise<NativeSegment[]> {
    return this._inFlight(this._intervals, hass, JSON.stringify([entityID, after, before]), () =>
      hass.callWS<NativeSegment[]>({ type: 'dvrkit/recordings/get', entity_id: entityID, after, before }));
  }

  public override getEngineType(): Engine { return Engine.Dvrkit; }

  public override async createCamera(config: CameraConfig): Promise<Camera> {
    return await new DvrkitCamera(config, this, { eventCallback: this._eventCallback }).initialize({
      hassManager: this._hassManager,
      entityRegistryManager: this._entityRegistryManager,
    });
  }

  public override generateDefaultRecordingQuery(
    _store: CameraManagerReadOnlyConfigStore, cameraIDs: Set<string>, query?: PartialRecordingQuery,
  ): RecordingQuery[] {
    return [{ source: QuerySource.Camera, type: QueryType.Recording, cameraIDs, ...query }];
  }

  public override generateDefaultRecordingSegmentsQuery(
    _store: CameraManagerReadOnlyConfigStore, cameraIDs: Set<string>, query: PartialRecordingSegmentsQuery,
  ): RecordingSegmentsQuery[] | null {
    if (!query.start || !query.end) {
      return null;
    }
    return [{ ...query, type: QueryType.RecordingSegments, cameraIDs, start: query.start, end: query.end }];
  }

  public override async getRecordings(
    hass: HomeAssistant, store: CameraManagerReadOnlyConfigStore, query: RecordingQuery,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options?: EngineOptions,
  ): Promise<RecordingQueryResultsMap | null> {
    if (hasUnsupportedFilters(query)) {
      return null;
    }
    const output: RecordingQueryResultsMap = new Map();
    await Promise.all([...query.cameraIDs].map(async (cameraID) => {
      const config = store.getCameraConfig(cameraID);
      const entityID = config && getCameraEntityFromConfig(config);
      if (!entityID) {
        return;
      }
      const summary = await this._getSummary(hass, entityID);
      const resolve = createDayHourResolver(summary.timezone);
      const hours: { start: Date; end: Date }[] = [];
      const seenHours = new Set<number>();
      for (const day of summary.days) {
        for (const hour of day.hours) {
          if (hour.duration <= 0) {
            continue;
          }
          const initial = hourInTimeZoneToDate(day.day, hour.hour, summary.timezone).getTime();
          // The summary merges repeated wall-clock hours. Query their actual
          // segments to avoid inventing a recording in the other occurrence.
          const candidates = [initial - 3600000, initial, initial + 3600000]
            .filter((time) => {
              const local = resolve(new Date(time));
              return local.day === day.day && local.hour === hour.hour;
            });
          const segments = candidates.length > 1
            ? await this._getInterval(
                hass, entityID, Math.min(...candidates) / 1000,
                (Math.max(...candidates) + 3600000) / 1000,
              )
            : null;
          for (const time of candidates) {
            const start = new Date(time);
            const end = new Date(time + 3600000);
            if (
              (!segments || segments.some((segment) =>
                segment.start_time < end.getTime() / 1000 &&
                segment.end_time > start.getTime() / 1000)) &&
              (!query.start || end > query.start) &&
              (!query.end || start < query.end) &&
              !seenHours.has(time)
            ) {
              hours.push({ start, end });
              seenHours.add(time);
            }
          }
        }
      }
      hours.sort((a, b) => b.start.getTime() - a.start.getTime());
      const selected = query.limit === undefined ? hours : hours.slice(0, query.limit);
      const recordings = selected.map(({ start, end }) => ({
        cameraID, start, end,
        url: `dvrkit://${encodeURIComponent(entityID)}/${start.getTime() / 1000}/${end.getTime() / 1000}`,
      }));
      const cameraQuery = { ...query, cameraIDs: new Set([cameraID]) };
      output.set(cameraQuery, { type: QueryResultsType.Recording, engine: Engine.Dvrkit, recordings, cached: false } as Results);
    }));
    return output.size ? output : null;
  }

  public override async getRecordingSegments(
    hass: HomeAssistant, store: CameraManagerReadOnlyConfigStore, query: RecordingSegmentsQuery,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options?: EngineOptions,
  ): Promise<RecordingSegmentsQueryResultsMap | null> {
    const output: RecordingSegmentsQueryResultsMap = new Map();
    await Promise.all([...query.cameraIDs].map(async (cameraID) => {
      const config = store.getCameraConfig(cameraID);
      const entityID = config && getCameraEntityFromConfig(config);
      if (!entityID) {
        return;
      }
      const native = await this._getInterval(
        hass, entityID, query.start.getTime() / 1000, query.end.getTime() / 1000,
      );
      const segments: RecordingSegment[] = native.map((segment) => ({
        start_time: segment.start_time, end_time: segment.end_time,
        id: `${cameraID}/${segment.start_time}/${segment.end_time}`,
      })).sort((a, b) => a.start_time - b.start_time);
      output.set({ ...query, cameraIDs: new Set([cameraID]) }, {
        type: QueryResultsType.RecordingSegments, engine: Engine.Dvrkit, segments, cached: false,
      });
    }));
    return output.size ? output : null;
  }

  public override generateMediaFromRecordings(
    _hass: HomeAssistant, _store: CameraManagerReadOnlyConfigStore,
    _query: RecordingQuery, results: RecordingQueryResults,
  ): ViewMedia[] | null {
    if (results.engine !== Engine.Dvrkit) {
      return null;
    }
    return (results as Results).recordings.map((recording) => new DvrkitRecordingViewMedia(recording));
  }

  public override async getMediaSeekTime(
    _hass: HomeAssistant, _store: CameraManagerReadOnlyConfigStore, media: ViewMedia,
    target: Date,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options?: EngineOptions,
  ): Promise<number | null> {
    const start = media.getStartTime();
    const end = media.getEndTime();
    const cameraID = media.getCameraID();
    if (!start || !end || !cameraID || target < start || target > end) {
      return null;
    }
    return (target.getTime() - start.getTime()) / 1000;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public override getMediaCapabilities(_media: ViewMedia): ViewItemCapabilities {
    return { canDownload: false, canFavorite: false };
  }
}
