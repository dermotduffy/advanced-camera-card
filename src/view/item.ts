import { clone } from 'lodash-es';

import type { FolderPathLevel } from '../card-controller/folders/types';
import type { FolderConfig } from '../config/schema/folders';
import type { Severity } from '../severity';

export enum ViewMediaType {
  Clip = 'clip',
  Snapshot = 'snapshot',
  Recording = 'recording',
  Review = 'review',
}

export interface ViewMediaSourceOptions {
  cameraID?: string;
  folder?: FolderConfig;
  path?: readonly FolderPathLevel[];
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
  public getID(): string | null {
    return null;
  }
  public getStartTime(): Date | null {
    return null;
  }
  public getPlaybackStartTime(): Date | null {
    return this.getStartTime();
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
  public getDescription(): string | null {
    return null;
  }

  // Returns a URL, or the Home Assistant media source ID of an image.
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

  public getSeverity(): Severity | null {
    return null;
  }
  public getWhere(): string[] | null {
    return null;
  }

  /**
   * Whether another object describes this same item.
   *
   * Two separate objects can describe one item, so the comparison is by
   * identifier rather than by object. Media and folders never match one
   * another, since their identifiers come from different namespaces. An item
   * without an identifier can only be matched by object.
   */
  public isSameAs(other: ViewItem): boolean {
    const id = this.getID();
    return (
      this === other ||
      (other instanceof ViewMedia && id !== null && id === other.getID())
    );
  }

  /**
   * Creates a shallow copy. Note this will (intentionally) result in underlying
   * data objects being shared between clones -- this ensures state written
   * through one object is visible through the other (e.g. favorite/review
   * status).
   */
  public clone(): this {
    return clone(this);
  }
}

export interface EventViewMedia extends ViewMedia {
  getScore(): number | null;
  getWhat(): string[] | null;
  getTags(): string[] | null;
}

export interface RecordingViewMedia extends ViewMedia {
  getEventCount(): number | null;
}

export interface ReviewViewMedia extends ViewMedia {
  getWhat(): string[] | null;
  isReviewed(): boolean | null;
}

interface ViewFolderParameters {
  icon?: string | null;
  id?: string | null;
  title?: string | null;
  thumbnail?: string | null;

  // Whether the folder configuration chose the thumbnail (rather than Home
  // Assistant reporting it).
  isThumbnailConfigured?: boolean;
}

export class ViewFolder {
  private _folder: FolderConfig;
  private _path: readonly FolderPathLevel[];

  private _icon: string | null;
  private _id: string | null;
  private _title: string | null;
  private _thumbnail: string | null;
  private _isThumbnailConfigured: boolean;

  constructor(
    folder: FolderConfig,
    path: readonly FolderPathLevel[],
    params?: ViewFolderParameters,
  ) {
    this._folder = folder;
    this._path = path;

    this._icon = params?.icon ?? null;
    this._id = params?.id ?? null;
    this._title = params?.title ?? null;
    this._thumbnail = params?.thumbnail ?? null;
    this._isThumbnailConfigured = params?.isThumbnailConfigured ?? false;
  }

  public getFolder(): FolderConfig {
    return this._folder;
  }
  public getPath(): readonly FolderPathLevel[] {
    return this._path;
  }
  public getID(): string | null {
    return this._id;
  }
  public getTitle(): string | null {
    return this._title;
  }
  public getDescription(): string | null {
    return null;
  }
  public getThumbnail(): string | null {
    return this._thumbnail;
  }
  public isThumbnailConfigured(): boolean {
    return this._isThumbnailConfigured;
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

  /** See ViewMedia.isSameAs() for explanation. */
  public isSameAs(other: ViewItem): boolean {
    const id = this.getID();
    return (
      this === other ||
      (other instanceof ViewFolder && id !== null && id === other.getID())
    );
  }

  /** See ViewMedia.clone() for explanation. */
  public clone(): this {
    return clone(this);
  }
}

export type ViewItem = ViewMedia | ViewFolder;
