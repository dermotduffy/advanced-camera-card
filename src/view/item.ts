import { FolderConfig } from '../config/schema/folders';

export enum ViewMediaType {
  Clip = 'clip',
  Snapshot = 'snapshot',
  Recording = 'recording',
}

export enum VideoContentType {
  MP4 = 'mp4',
  HLS = 'hls',
}

export interface ViewMediaSourceOptions {
  cameraID?: string;
  folder?: FolderConfig;
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
  public isFavorite(): boolean | null {
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
  public getWhere(): string[] | null {
    return null;
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

interface ViewFolderParameters {
  icon?: string | null;
  path?: string | null;
  title?: string | null;
  thumbnail?: string | null;
}

export class ViewFolder {
  private _folder: FolderConfig;

  private _icon: string | null;
  private _path: string | null;
  private _title: string | null;
  private _thumbnail: string | null;

  constructor(folder: FolderConfig, params?: ViewFolderParameters) {
    this._folder = folder;

    this._icon = params?.icon ?? null;
    this._path = params?.path ?? null;
    this._title = params?.title ?? null;
    this._thumbnail = params?.thumbnail ?? null;
  }

  public getFolder(): FolderConfig {
    return this._folder;
  }
  public getID(): string | null {
    return this.getPath();
  }
  public getPath(): string | null {
    return this._path;
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
  public isFavorite(): boolean | null {
    return null;
  }
}

export type ViewItem = ViewMedia | ViewFolder;
