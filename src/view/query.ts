import { cloneDeep, isEqual, uniqWith } from 'lodash-es';
import { EventQuery, MediaQuery, RecordingQuery } from '../camera-manager/types.js';
import { FolderQuery } from '../card-controller/folders/types.js';
import { setify } from '../utils/basic.js';

export type MediaQueries = EventMediaQuery | RecordingMediaQuery;
export type Query = MediaQueries | FolderViewQuery;

class ViewQuery<T> {
  protected _query: T | null = null;

  public constructor(query?: T) {
    if (query) {
      this._query = query;
    }
  }

  public getQuery(): T | null {
    return this._query;
  }

  public setQuery(query: T): this {
    this._query = query;
    return this;
  }

  public clone(): this {
    return cloneDeep(this);
  }
}

class MediaQueryBase<T extends MediaQuery> extends ViewQuery<T[]> {
  public getQueryCameraIDs(): Set<string> | null {
    if (!this._query) {
      return null;
    }
    const cameraIDs: Set<string> = new Set();
    this._query.forEach((query) =>
      [...query.cameraIDs].forEach((cameraID) => cameraIDs.add(cameraID)),
    );
    return cameraIDs;
  }

  public setQueryCameraIDs(cameraIDs: string | Set<string>): this {
    if (!this._query) {
      return this;
    }
    const rewrittenQueries: T[] = [];
    this._query.forEach((query) =>
      rewrittenQueries.push({ ...query, cameraIDs: setify(cameraIDs) }),
    );
    this._query = uniqWith(rewrittenQueries, isEqual);
    return this;
  }

  public hasQueriesForCameraIDs(cameraIDs: Set<string>) {
    for (const cameraID of cameraIDs) {
      if (!this._query?.some((query) => query.cameraIDs.has(cameraID))) {
        return false;
      }
    }
    return true;
  }

  public isSupersetOf(that: MediaQueries): boolean {
    // Queries are typically a single item, so quadratic complexity here is
    // likely still a lot better than going to the network for a new set of
    // query results.
    for (const thatQuery of that.getQuery() ?? []) {
      let haveMatch = false;
      for (const thisQuery of this._query ?? []) {
        // Compare the query except the times, and then separately compare the
        // times taking into account whether source time is larger than target
        // time.
        if (
          isEqual(
            {
              ...thisQuery,
              end: null,
              start: null,
            },
            { ...thatQuery, end: null, start: null },
          ) &&
          ((!thisQuery.start && !thatQuery.start) ||
            (thisQuery.start &&
              thatQuery.start &&
              thisQuery.start <= thatQuery.start)) &&
          ((!thisQuery.end && !thatQuery.end) ||
            (thisQuery.end && thatQuery.end && thisQuery.end >= thatQuery.end))
        ) {
          haveMatch = true;
          break;
        }
      }

      if (!haveMatch) {
        return false;
      }
    }
    return true;
  }
}

export class EventMediaQuery extends MediaQueryBase<EventQuery> {
  public convertToClipsQueries(): this {
    for (const query of this._query ?? []) {
      delete query.hasSnapshot;
      query.hasClip = true;
    }
    return this;
  }
}

export class RecordingMediaQuery extends MediaQueryBase<RecordingQuery> {}

export class FolderViewQuery extends ViewQuery<FolderQuery> {}
