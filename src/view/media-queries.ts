import cloneDeep from 'lodash-es/cloneDeep.js';
import isEqual from 'lodash-es/isEqual.js';
import uniqWith from 'lodash-es/uniqWith.js';
import { EventQuery, MediaQuery, RecordingQuery } from '../camera-manager/types.js';
import { setify } from '../utils/basic.js';

export type MediaQueries = EventMediaQueries | RecordingMediaQueries;

class MediaQueriesBase<T extends MediaQuery> {
  protected _queries: T[] | null = null;

  public constructor(queries?: T[]) {
    if (queries) {
      this._queries = queries;
    }
  }

  public clone(): this {
    return cloneDeep(this);
  }

  public getQueries(): T[] | null {
    return this._queries;
  }

  public setQueries(queries: T[]): this {
    this._queries = queries;
    return this;
  }

  public getQueryCameraIDs(): Set<string> | null {
    if (!this._queries) {
      return null;
    }
    const cameraIDs: Set<string> = new Set();
    this._queries.forEach((query) =>
      [...query.cameraIDs].forEach((cameraID) => cameraIDs.add(cameraID)),
    );
    return cameraIDs;
  }

  public setQueryCameraIDs(cameraIDs: string | Set<string>): this {
    if (!this._queries) {
      return this;
    }
    const rewrittenQueries: T[] = [];
    this._queries.forEach((query) =>
      rewrittenQueries.push({ ...query, cameraIDs: setify(cameraIDs) }),
    );
    this._queries = uniqWith(rewrittenQueries, isEqual);
    return this;
  }

  public hasQueriesForCameraIDs(cameraIDs: Set<string>) {
    for (const cameraID of cameraIDs) {
      if (!this._queries?.some((query) => query.cameraIDs.has(cameraID))) {
        return false;
      }
    }
    return true;
  }

  public isSupersetOf(that: MediaQueries): boolean {
    // Queries are typically a single item, so quadratic complexity here is
    // likely still a lot better than going to the network for a new set of
    // query results.
    for (const thatQuery of that.getQueries() ?? []) {
      let haveMatch = false;
      for (const thisQuery of this._queries ?? []) {
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

export class EventMediaQueries extends MediaQueriesBase<EventQuery> {
  public convertToClipsQueries(): this {
    for (const query of this._queries ?? []) {
      delete query.hasSnapshot;
      query.hasClip = true;
    }
    return this;
  }
}

export class RecordingMediaQueries extends MediaQueriesBase<RecordingQuery> {}
