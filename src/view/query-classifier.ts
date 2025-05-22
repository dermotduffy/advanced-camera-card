import { EventMediaQuery, FolderViewQuery, Query, RecordingMediaQuery } from './query';

export type QueryType = 'event' | 'recording' | 'folder';
type MediaType = 'clips' | 'snapshots' | 'recordings';

export class QueryClassifier {
  public static isEventQuery(query?: Query | null): query is EventMediaQuery {
    return query instanceof EventMediaQuery;
  }

  public static isRecordingQuery(query?: Query | null): query is RecordingMediaQuery {
    return query instanceof RecordingMediaQuery;
  }

  public static isMediaQuery(
    query?: Query | null,
  ): query is EventMediaQuery | RecordingMediaQuery {
    return this.isEventQuery(query) || this.isRecordingQuery(query);
  }

  public static isFolderQuery(query?: Query | null): query is FolderViewQuery {
    return query instanceof FolderViewQuery;
  }

  public static isClipsQuery(query?: Query | null): boolean {
    return (
      this.isEventQuery(query) && !!query?.getQuery()?.every((query) => query.hasClip)
    );
  }

  public static isSnapshotQuery(query?: Query | null): boolean {
    return (
      this.isEventQuery(query) &&
      !!query?.getQuery()?.every((query) => query.hasSnapshot)
    );
  }

  public static getQueryType(query?: Query | null): QueryType | null {
    return this.isEventQuery(query)
      ? 'event'
      : this.isRecordingQuery(query)
        ? 'recording'
        : this.isFolderQuery(query)
          ? 'folder'
          : null;
  }

  public static getMediaType(query?: Query | null): MediaType | null {
    return this.isClipsQuery(query)
      ? 'clips'
      : this.isSnapshotQuery(query)
        ? 'snapshots'
        : this.isRecordingQuery(query)
          ? 'recordings'
          : null;
  }
}
