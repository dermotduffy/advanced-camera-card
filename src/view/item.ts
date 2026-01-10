import { clone } from 'lodash-es';
import { FolderPathComponent } from '../card-controller/folders/types';
import { FolderConfig } from '../config/schema/folders';
import { Severity } from '../types';

export enum ViewMediaType {
  Clip = 'clip',
  Snapshot = 'snapshot',
  Recording = 'recording',
  Review = 'review',
}

export enum VideoContentType {
  MP4 = 'mp4',
  HLS = 'hls',
}

export interface ViewMediaSourceOptions {
  cameraID?: string;
  folder?: FolderConfig;
  path?: readonly FolderPathComponent[];
}

export class ViewMedia {
  protected _mediaType: ViewMediaType;
  protected _cameraID: string | null;
  protected _folder: FolderConfig | null;

  constructor(mediaType: ViewMediaType, options?: ViewMediaSourceOptions) {
    this._mediaType = mediaType;
    this._cameraID = options?.cameraID ?? null;
    this._folder = options?.folder ?? null;
  }
  public getCameraID(): string | null {
    return this._cameraID;
  }
  public getFolder(): FolderConfig | null {
    return this._folder;
  }
  public getMediaType(): ViewMediaType {
    return this._mediaType;
  }
  public getVideoContentType(): VideoContentType | null {
    return null;
  }
  public getID(): string | null {
    return null;
  }
  public getStartTime(): Date | null {
    return null;
  }
  public getEndTime(): Date | null {
    return null;
  }
  public getUsableEndTime(): Date | null {
    return this.getEndTime() ?? (this.inProgress() ? new Date() : this.getStartTime());
  }
  public inProgress(): boolean | null {
    return null;
  }
  public getContentID(): string | null {
    return null;
  }
  public getTitle(): string | null {
    return null;
  }
  public getThumbnail(): string | null {
    return null;
  }
  public getIcon(): string | null {
    return null;
  }
  public isFavorite(): boolean | null {
    return null;
  }
  public isReviewed(): boolean | null {
    return null;
  }
  public includesTime(seek: Date): boolean {
    const startTime = this.getStartTime();
    const endTime = this.getUsableEndTime();
    return !!startTime && !!endTime && seek >= startTime && seek <= endTime;
  }

  // Sets the favorite attribute (if any). This purely sets the media item as a
  // favorite in JS.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public setFavorite(_favorite: boolean): void {
    return;
  }
  public getSeverity(): Severity | null {
    return null;
  }
  public getWhere(): string[] | null {
    return null;
  }

  /**
   * Creates a shallow clone of this ViewMedia instance.
   *
   * This is needed because Lit components use reference equality (===) to
   * detect property changes. When we mutate an item's state (e.g.,
   * setReviewed), the reference doesn't change, so Lit doesn't re-render. By
   * cloning the item before mutation and replacing it in the QueryResults, we
   * ensure Lit sees a new reference and updates the UI.
   */
  public clone(): this {
    return clone(this);
  }
}

export interface EventViewMedia extends ViewMedia {
  getScore(): number | null;
  getWhat(): string[] | null;
  getTags(): string[] | null;
  isGroupableWith(that: EventViewMedia): boolean;
}

export interface RecordingViewMedia extends ViewMedia {
  getEventCount(): number | null;
}

export interface ReviewViewMedia extends ViewMedia {
  getWhat(): string[] | null;
  isReviewed(): boolean | null;
  setReviewed(reviewed: boolean): void;
}

interface ViewFolderParameters {
  icon?: string | null;
  id?: string | null;
  title?: string | null;
  thumbnail?: string | null;
}

export class ViewFolder {
  private _folder: FolderConfig;
  private _path: readonly FolderPathComponent[];

  private _icon: string | null;
  private _id: string | null;
  private _title: string | null;
  private _thumbnail: string | null;

  constructor(
    folder: FolderConfig,
    path: readonly FolderPathComponent[],
    params?: ViewFolderParameters,
  ) {
    this._folder = folder;
    this._path = path;

    this._icon = params?.icon ?? null;
    this._id = params?.id ?? null;
    this._title = params?.title ?? null;
    this._thumbnail = params?.thumbnail ?? null;
  }

  public getFolder(): FolderConfig {
    return this._folder;
  }
  public getPath(): readonly FolderPathComponent[] {
    return this._path;
  }
  public getID(): string | null {
    return this._id;
  }
  public getTitle(): string | null {
    return this._title;
  }
  public getThumbnail(): string | null {
    return this._thumbnail;
  }
  public getIcon(): string | null {
    return this._icon;
  }
  public getSeverity(): Severity | null {
    return null;
  }
  public isFavorite(): boolean | null {
    return null;
  }

  /** See ViewMedia.clone() for explanation. */
  public clone(): this {
    return clone(this);
  }
}

export type ViewItem = ViewMedia | ViewFolder;
