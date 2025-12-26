import {
  EventMediaQuery,
  FolderViewQuery,
  Query,
  RecordingMediaQuery,
  ReviewMediaQuery,
} from './query';

export type QueryType = 'event' | 'recording' | 'review' | 'folder';
type MediaType = 'clips' | 'snapshots' | 'recordings' | 'reviews';

export class QueryClassifier {
  public static isEventQuery(query?: Query | null): query is EventMediaQuery {
    return query instanceof EventMediaQuery;
  }

  public static isRecordingQuery(query?: Query | null): query is RecordingMediaQuery {
    return query instanceof RecordingMediaQuery;
  }

  public static isReviewQuery(query?: Query | null): query is ReviewMediaQuery {
    return query instanceof ReviewMediaQuery;
  }

  public static isMediaQuery(
    query?: Query | null,
  ): query is EventMediaQuery | RecordingMediaQuery | ReviewMediaQuery {
    return (
      this.isEventQuery(query) ||
      this.isRecordingQuery(query) ||
      this.isReviewQuery(query)
    );
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
        : this.isReviewQuery(query)
          ? 'review'
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
          : this.isReviewQuery(query)
            ? 'reviews'
            : null;
  }
}
