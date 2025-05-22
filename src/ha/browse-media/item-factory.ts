import { ViewItem, ViewMediaSourceOptions, ViewMediaType } from '../../view/item';
import { BrowseMediaEventViewMedia, BrowseMediaViewFolder } from './item';
import {
  BrowseMediaMetadata,
  MEDIA_CLASS_IMAGE,
  MEDIA_CLASS_VIDEO,
  RichBrowseMedia,
} from './types';

export class BrowseMediaViewItemFactory {
  static create(
    browseMedia: RichBrowseMedia<BrowseMediaMetadata | undefined>,
    options?: ViewMediaSourceOptions,
  ): ViewItem | null {
    if (browseMedia.can_expand) {
      return options?.folder
        ? new BrowseMediaViewFolder(options.folder, browseMedia)
        : null;
    }

    const mediaType =
      browseMedia.media_class === MEDIA_CLASS_VIDEO
        ? ViewMediaType.Clip
        : browseMedia.media_class === MEDIA_CLASS_IMAGE
          ? ViewMediaType.Snapshot
          : null;

    return mediaType
      ? new BrowseMediaEventViewMedia(mediaType, browseMedia, options)
      : null;
  }
}
