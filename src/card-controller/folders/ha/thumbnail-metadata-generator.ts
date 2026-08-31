import type { Parser, ThumbnailParser } from '../../../config/schema/folders';
import {
  MEDIA_CLASS_IMAGE,
  type BrowseMedia,
  type BrowseMediaMetadata,
  type RichBrowseMedia,
} from '../../../ha/browse-media/types';
import type { HomeAssistant } from '../../../ha/types';
import { regexpExtract } from '../../../utils/regexp-extract';
import type { TemplateRenderer } from '../../templates';
import { getTemplateMediaData } from './template-media-data';
import { REGEXP_GROUP_VALUE_KEY } from './types';

const TITLE_EXTENSION_REGEXP = /\.[^.]+$/;

const isThumbnailParser = (parser: Parser): parser is ThumbnailParser =>
  parser.type === 'thumbnail';

const isImage = (media: BrowseMedia): boolean =>
  !media.can_expand && media.media_class === MEDIA_CLASS_IMAGE;

export class ThumbnailMetadataGenerator {
  private _templateRenderer: TemplateRenderer;

  constructor(templateRenderer: TemplateRenderer) {
    this._templateRenderer = templateRenderer;
  }

  // Find the thumbnail of each of the given media and folders, which requires
  // comparing what is in the same folder to one another. The metadata of what
  // is given is modified in place.
  public generate(
    hass: HomeAssistant,
    siblings: RichBrowseMedia<BrowseMediaMetadata>[],
    parsers?: Parser[],
  ): void {
    const thumbnailParsers = parsers?.filter(isThumbnailParser);
    if (!thumbnailParsers?.length) {
      return;
    }

    for (const parser of thumbnailParsers) {
      if (parser.value_template) {
        this._generateFromTemplate(hass, siblings, parser.value_template);
      } else {
        this._generateFromSiblings(siblings, parser);
      }
    }
  }

  // Remove the media that other media in the given results uses as its
  // thumbnail, so that an image is not shown both as a thumbnail and in its own
  // right.
  public removeThumbnailsOfOtherMedia(
    results: RichBrowseMedia<BrowseMediaMetadata>[],
  ): RichBrowseMedia<BrowseMediaMetadata>[] {
    // The thumbnails media point at, ignoring media that point at themselves.
    const thumbnails = new Set(
      results.flatMap((item) =>
        item._metadata?.thumbnailOverride &&
        item._metadata.thumbnailOverride !== item.media_content_id
          ? [item._metadata.thumbnailOverride]
          : [],
      ),
    );

    return results.filter((item) => !thumbnails.has(item.media_content_id));
  }

  private _generateFromTemplate(
    hass: HomeAssistant,
    siblings: RichBrowseMedia<BrowseMediaMetadata>[],
    valueTemplate: string,
  ): void {
    for (const item of siblings) {
      if (item._metadata?.thumbnailOverride) {
        continue;
      }

      const thumbnail = this._templateRenderer.renderRecursively(hass, valueTemplate, {
        mediaData: getTemplateMediaData(item),
      });
      if (typeof thumbnail === 'string' && thumbnail.length) {
        this._setThumbnailOverride(item, thumbnail);
      }
    }
  }

  private _generateFromSiblings(
    siblings: RichBrowseMedia<BrowseMediaMetadata>[],
    parser: ThumbnailParser,
  ): void {
    // Media and folders keyed by the matching value extracted from their
    // titles.
    const groups = new Map<string, RichBrowseMedia<BrowseMediaMetadata>[]>();
    for (const item of siblings) {
      const key = parser.regexp
        ? regexpExtract(parser.regexp, item.title, {
            groupName: REGEXP_GROUP_VALUE_KEY,
          })
        : item.title.replace(TITLE_EXTENSION_REGEXP, '');
      if (key) {
        groups.set(key, [...(groups.get(key) ?? []), item]);
      }
    }

    for (const group of groups.values()) {
      const firstImageInGroup = group.find(isImage);

      for (const item of group) {
        if (isImage(item)) {
          // An image is its own thumbnail.
          this._setThumbnailOverride(item, item.media_content_id);
        } else if (firstImageInGroup) {
          this._setThumbnailOverride(item, firstImageInGroup.media_content_id);
        }
      }
    }
  }

  private _setThumbnailOverride(
    media: RichBrowseMedia<BrowseMediaMetadata>,
    thumbnailOverride: string,
  ): void {
    if (media._metadata?.thumbnailOverride) {
      return;
    }
    media._metadata = { ...media._metadata, thumbnailOverride };
  }
}
