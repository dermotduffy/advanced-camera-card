import {
  QueryType,
  type EventQuery,
  type RecordingQuery,
  type ReviewQuery,
} from '../../src/camera-manager/types';
import type { FolderQuery } from '../../src/card-controller/folders/types';
import type { FolderConfig } from '../../src/config/schema/folders';
import { QuerySource } from '../../src/query-source';
import type { Severity } from '../../src/severity';
import {
  ViewMedia,
  ViewMediaType,
  type EventViewMedia,
  type ReviewViewMedia,
} from '../../src/view/item';
import { QueryResults } from '../../src/view/query-results';
import { View, type ViewParameters } from '../../src/view/view';

export class TestViewMedia extends ViewMedia implements EventViewMedia, ReviewViewMedia {
  private _icon: string | null = null;
  private _id: string | null;
  private _startTime: Date | null;
  private _endTime: Date | null;
  private _inProgress: boolean | null;
  private _contentID: string | null;
  private _title: string | null;
  private _thumbnail: string | null;
  private _what: string[] | null = null;
  private _score: number | null = null;
  private _tags: string[] | null = null;
  private _where: string[] | null = null;
  private _severity: Severity | null = null;
  private _reviewed: boolean | null = null;
  private _description: string | null = null;
  private _favorite: boolean | null = null;

  constructor(options?: {
    id?: string | null;
    startTime?: Date | null;
    mediaType?: ViewMediaType;
    cameraID?: string | null;
    folder?: FolderConfig | null;
    endTime?: Date | null;
    inProgress?: boolean;
    contentID?: string;
    title?: string | null;
    description?: string | null;
    thumbnail?: string | null;
    icon?: string | null;
    what?: string[] | null;
    score?: number | null;
    tags?: string[] | null;
    where?: string[] | null;
    severity?: Severity | null;
    reviewed?: boolean | null;
    favorite?: boolean | null;
  }) {
    super(options?.mediaType ?? ViewMediaType.Clip, {
      ...(options?.cameraID !== null &&
        !options?.folder && { cameraID: options?.cameraID ?? 'camera' }),
      ...(options?.folder && { folder: options.folder }),
    });
    this._id = options?.id !== undefined ? options.id : 'id';
    this._startTime = options?.startTime ?? null;
    this._endTime = options?.endTime ?? null;
    this._inProgress = options?.inProgress !== undefined ? options.inProgress : false;
    this._contentID = options?.contentID ?? null;
    this._title = options?.title !== undefined ? options.title : null;
    this._description = options?.description !== undefined ? options.description : null;
    this._thumbnail = options?.thumbnail !== undefined ? options.thumbnail : null;
    this._icon = options?.icon !== undefined ? options.icon : null;
    this._what = options?.what !== undefined ? options.what : null;
    this._score = options?.score !== undefined ? options.score : null;
    this._tags = options?.tags !== undefined ? options.tags : null;
    this._where = options?.where !== undefined ? options.where : null;
    this._severity = options?.severity !== undefined ? options.severity : null;
    this._reviewed = options?.reviewed !== undefined ? options.reviewed : null;
    this._favorite = options?.favorite !== undefined ? options.favorite : null;
  }
  public getIcon(): string | null {
    return this._icon;
  }
  public getID(): string | null {
    return this._id;
  }
  public getStartTime(): Date | null {
    return this._startTime;
  }
  public getEndTime(): Date | null {
    return this._endTime;
  }
  public inProgress(): boolean | null {
    return this._inProgress;
  }
  public getContentID(): string | null {
    return this._contentID;
  }
  public getTitle(): string | null {
    return this._title;
  }
  public getDescription(): string | null {
    return this._description;
  }
  public getThumbnail(): string | null {
    return this._thumbnail;
  }
  public getWhat(): string[] | null {
    return this._what;
  }
  public getScore(): number | null {
    return this._score;
  }
  public getTags(): string[] | null {
    return this._tags;
  }
  public getWhere(): string[] | null {
    return this._where;
  }
  public getSeverity(): Severity | null {
    return this._severity;
  }
  public isReviewed(): boolean | null {
    return this._reviewed;
  }
  public setReviewed(reviewed: boolean): void {
    this._reviewed = reviewed;
  }
  public isFavorite(): boolean | null {
    return this._favorite;
  }
  public setFavorite(favorite: boolean): void {
    this._favorite = favorite;
  }
}

// jsdom does not implement `window.matchMedia`, so it has to be installed
// before a test can control what it returns. Must be called from inside a test
// or a test hook, as the stub is removed once the test finishes.

export const generateViewMediaArray = (options?: {
  cameraIDs?: string[];
  count?: number;
}): ViewMedia[] => {
  const media: ViewMedia[] = [];
  for (let i = 0; i < (options?.count ?? 100); ++i) {
    for (const cameraID of options?.cameraIDs ?? ['kitchen', 'office']) {
      media.push(
        new TestViewMedia({
          cameraID: cameraID,
          id: `id-${cameraID}-${i}`,
        }),
      );
    }
  }
  return media;
};

// ViewMedia itself has no native way to set startTime and ID that aren't linked
// to an engine.

export const createView = (options?: Partial<ViewParameters>): View => {
  return new View({
    view: 'live',
    camera: 'camera',
    ...options,
  });
};

export const createViewWithMedia = (options?: Partial<ViewParameters>): View => {
  const media = generateViewMediaArray({ count: 5 });
  return createView({
    queryResults: new QueryResults({
      results: media,
      selectedIndex: 0,
    }),
    ...options,
  });
};

export const createEventQuery = (
  cameraID: string,
  options?: Partial<EventQuery>,
): EventQuery => ({
  source: QuerySource.Camera,
  type: QueryType.Event,
  cameraIDs: new Set([cameraID]),
  ...options,
});

export const createRecordingQuery = (
  cameraID: string,
  options?: Partial<RecordingQuery>,
): RecordingQuery => ({
  source: QuerySource.Camera,
  type: QueryType.Recording,
  cameraIDs: new Set([cameraID]),
  ...options,
});

export const createReviewQuery = (
  cameraID: string,
  options?: Partial<ReviewQuery>,
): ReviewQuery => ({
  source: QuerySource.Camera,
  type: QueryType.Review,
  cameraIDs: new Set([cameraID]),
  ...options,
});

export const createFolderQuery = (folderId: string): FolderQuery => ({
  source: QuerySource.Folder,
  folder: { id: folderId, type: 'ha', title: folderId },
  path: [{ ha: { id: 'Root' } }],
});

export const isEventQuery = (node: {
  source: QuerySource;
  type?: QueryType;
}): node is EventQuery =>
  node.source === QuerySource.Camera && node.type === QueryType.Event;

export const isRecordingQuery = (node: {
  source: QuerySource;
  type?: QueryType;
}): node is RecordingQuery =>
  node.source === QuerySource.Camera && node.type === QueryType.Recording;

export const isReviewQuery = (node: {
  source: QuerySource;
  type?: QueryType;
}): node is ReviewQuery =>
  node.source === QuerySource.Camera && node.type === QueryType.Review;

export const isFolderQuery = (node: { source: QuerySource }): node is FolderQuery =>
  node.source === QuerySource.Folder;
