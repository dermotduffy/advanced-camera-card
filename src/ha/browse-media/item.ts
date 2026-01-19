import { format } from 'date-fns';
import { isEqual } from 'lodash-es';
import { FolderPathComponent } from '../../card-controller/folders/types';
import { FolderConfig } from '../../config/schema/folders';
import { formatDateAndTime } from '../../utils/basic';
import {
  EventViewMedia,
  VideoContentType,
  ViewFolder,
  ViewMedia,
  ViewMediaSourceOptions,
  ViewMediaType,
} from '../../view/item';
import { BrowseMediaMetadata, RichBrowseMedia } from './types';

interface MediaClassBrowserSetting {
  icon: string;
}

const mediaClassBrowserSettings: Record<string, MediaClassBrowserSetting> = {
  album: { icon: 'mdi:album' },
  app: { icon: 'mdi:application' },
  artist: { icon: 'mdi:account-music' },
  channel: { icon: 'mdi:television-classic' },
  composer: { icon: 'mdi:account-music-outline' },
  contributing_artist: { icon: 'mdi:account-music' },
  directory: { icon: 'mdi:folder' },
  episode: { icon: 'mdi:television-classic' },
  game: { icon: 'mdi:gamepad-variant' },
  genre: { icon: 'mdi:drama-masks' },
  image: { icon: 'mdi:image' },
  movie: { icon: 'mdi:movie' },
  music: { icon: 'mdi:music' },
  playlist: { icon: 'mdi:playlist-music' },
  podcast: { icon: 'mdi:podcast' },
  season: { icon: 'mdi:television-classic' },
  track: { icon: 'mdi:file-music' },
  tv_show: { icon: 'mdi:television-classic' },
  url: { icon: 'mdi:web' },
  video: { icon: 'mdi:video' },
};

const getIcon = (mediaClass: string): string | null => {
  return mediaClassBrowserSettings[mediaClass]?.icon ?? null;
};

export class BrowseMediaEventViewMedia extends ViewMedia implements EventViewMedia {
  protected _browseMedia: RichBrowseMedia<BrowseMediaMetadata | undefined>;
  protected _id: string;
  protected _icon: string | null;

  constructor(
    mediaType: ViewMediaType,
    browseMedia: RichBrowseMedia<BrowseMediaMetadata | undefined>,
    options?: ViewMediaSourceOptions,
  ) {
    super(mediaType, {
      cameraID: options?.cameraID ?? browseMedia._metadata?.cameraID,
      ...options,
    });
    this._browseMedia = browseMedia;
    this._icon = getIcon(browseMedia.media_class);

    // Generate a custom ID that uses the start date (to allow multiple
    // BrowseMedia objects (e.g. images and movies) to be de-duplicated).
    this._id =
      browseMedia._metadata?.startDate && this._cameraID
        ? `${this._cameraID}/${format(
            browseMedia._metadata.startDate,
            'yyyy-MM-dd HH:mm:ss',
          )}`
        : browseMedia.media_content_id;
  }

  public getStartTime(): Date | null {
    return this._browseMedia._metadata?.startDate ?? null;
  }
  public getEndTime(): Date | null {
    return this._browseMedia._metadata?.endDate ?? null;
  }
  public getVideoContentType(): VideoContentType | null {
    return this._mediaType === ViewMediaType.Clip ? VideoContentType.MP4 : null;
  }
  public getID(): string {
    return this._id;
  }
  public getContentID(): string {
    return this._browseMedia.media_content_id;
  }
  public getTitle(): string | null {
    const startTime = this.getStartTime();
    return startTime ? formatDateAndTime(startTime) : this._browseMedia.title;
  }
  public getThumbnail(): string | null {
    return this._browseMedia.thumbnail;
  }
  public getIcon(): string | null {
    return this._icon;
  }
  public getWhat(): string[] | null {
    return this._browseMedia._metadata?.what ?? null;
  }
  public getScore(): number | null {
    return null;
  }
  public getTags(): string[] | null {
    return null;
  }
  public isGroupableWith(that: EventViewMedia): boolean {
    return (
      this.getMediaType() === that.getMediaType() &&
      isEqual(this.getWhat(), that.getWhat())
    );
  }
}

export class BrowseMediaViewFolder extends ViewFolder {
  private _browseMedia: RichBrowseMedia<BrowseMediaMetadata>;

  constructor(
    folder: FolderConfig,
    path: readonly FolderPathComponent[],
    browseMedia: RichBrowseMedia<BrowseMediaMetadata>,
  ) {
    super(folder, path, {
      id: browseMedia.media_content_id,
      icon: getIcon(browseMedia.children_media_class ?? browseMedia.media_class),
      title: browseMedia.title,
      thumbnail: browseMedia.thumbnail,
    });
    this._browseMedia = browseMedia;
  }

  public getBrowseMedia(): RichBrowseMedia<BrowseMediaMetadata> {
    return this._browseMedia;
  }
}
