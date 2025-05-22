import { orderBy, sortedUniqBy } from 'lodash-es';
import { DateRange, MemoryRangeSet } from './range';
import { RecordingSegment } from './types';

class MemoryRangedCache<Data> {
  protected _ranges: MemoryRangeSet = new MemoryRangeSet();
  protected _data: Data[] = [];
  protected _timeFunc: (data: Data) => number;
  protected _idFunc: (data: Data) => string;

  constructor(timeFunc: (data: Data) => number, idFunc: (data: Data) => string) {
    this._timeFunc = timeFunc;
    this._idFunc = idFunc;
  }

  public add(range: DateRange, data: Data[]) {
    this._ranges.add(range);
    this._data = sortedUniqBy(
      orderBy(this._data.concat(data), this._timeFunc, 'asc'),
      this._idFunc,
    );
  }

  public hasCoverage(range: DateRange): boolean {
    return this._ranges.hasCoverage(range);
  }

  public get(range: DateRange): Data[] | null {
    if (!this.hasCoverage(range)) {
      return null;
    }

    const output: Data[] = [];
    for (const data of this._data) {
      const start = this._timeFunc(data);
      if (start >= range.start.getTime()) {
        if (start > range.end.getTime()) {
          // Data is kept in order.
          break;
        }
        output.push(data);
      }
    }
    return output;
  }

  public getSize(): number {
    return this._data.length;
  }

  /**
   * Remove old data that matches a given predicate. No change to the covered
   * ranges is made, i.e. this is asserting authoritiatively that this data does
   * not exist in the current ranges.
   * @param predicate A predicate to run on each data element.
   */
  public expireMatches(predicate: (data: Data) => boolean): void {
    this._data = this._data.filter((data) => !predicate(data));
  }
}

export class RecordingSegmentsCache {
  protected _segments: Map<string, MemoryRangedCache<RecordingSegment>> = new Map();

  public add(cameraID: string, range: DateRange, segments: RecordingSegment[]) {
    let cameraSegmentCache: MemoryRangedCache<RecordingSegment> | undefined =
      this._segments.get(cameraID);
    if (!cameraSegmentCache) {
      cameraSegmentCache = new MemoryRangedCache(
        (segment: RecordingSegment) => segment.start_time * 1000,
        (segment: RecordingSegment) => segment.id,
      );
      this._segments.set(cameraID, cameraSegmentCache);
    }
    cameraSegmentCache.add(range, segments);
  }

  public clear(): void {
    this._segments.clear();
  }

  public hasCoverage(cameraID: string, range: DateRange): boolean {
    return !!this._segments.get(cameraID)?.hasCoverage(range);
  }

  public get(cameraID: string, range: DateRange): RecordingSegment[] | null {
    return this._segments.get(cameraID)?.get(range) ?? null;
  }

  public getSize(cameraID: string): number | null {
    return this._segments.get(cameraID)?.getSize() ?? null;
  }

  public getCameraIDs(): string[] {
    return [...this._segments.keys()];
  }

  public expireMatches(
    cameraID: string,
    func: (segment: RecordingSegment) => boolean,
  ): void {
    this._segments.get(cameraID)?.expireMatches(func);
  }
}
