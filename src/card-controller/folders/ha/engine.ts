import { sub } from 'date-fns';
import type { NonEmptyTuple } from 'type-fest';

import type { ConditionState } from '../../../condition-trigger/conditions/types';
import {
  folderTypeSchema,
  type FolderConfig,
  type HAFolderConfig,
  type HAFolderPathComponent,
} from '../../../config/schema/folders';
import { getViewItemsFromBrowseMediaArray } from '../../../ha/browse-media/browse-media-to-view-media';
import { BrowseMediaViewFolder } from '../../../ha/browse-media/item';
import {
  BROWSE_MEDIA_CACHE_SECONDS,
  BrowseMediaCache,
  type BrowseMediaMetadata,
} from '../../../ha/browse-media/types';
import {
  BrowseMediaWalker,
  type BrowseMediaStep,
  type BrowseMediaTarget,
} from '../../../ha/browse-media/walker';
import { getMediaDownloadPath } from '../../../ha/download';
import { HA_MEDIA_SOURCE_ROOT } from '../../../ha/media-source';
import type { HomeAssistant } from '../../../ha/types';
import { QuerySource } from '../../../query-source.js';
import type { Endpoint } from '../../../types';
import type { ViewItem } from '../../../view/item';
import { ViewItemClassifier } from '../../../view/item-classifier';
import type { ViewItemCapabilities } from '../../../view/types';
import type { TemplateRenderer } from '../../templates';
import type {
  DownloadHelpers,
  EngineOptions,
  FolderPathComponent,
  FolderQuery,
  FoldersEngine,
} from '../types';
import { MediaMatcher } from './media-matcher';
import { MetadataGenerator } from './metadata-generator.js';
import { ThumbnailMetadataGenerator } from './thumbnail-metadata-generator';

interface WalkPlan {
  // Where the walk starts browsing.
  start: BrowseMediaTarget<BrowseMediaMetadata>;

  // What to match and parse at each level below the start, one entry per level.
  levels: FolderPathComponent[];
}

// Find the deepest component that identifies a folder to browse: a folder the
// user clicked, or a media source id from the configuration.
const getWalkPlan = (path: readonly FolderPathComponent[]): WalkPlan | null => {
  for (let index = path.length - 1; index >= 0; index--) {
    const component = path[index];

    if (component.folder instanceof BrowseMediaViewFolder) {
      return { start: component.folder.getBrowseMedia(), levels: path.slice(index + 1) };
    }
    if (component.ha?.id) {
      return { start: component.ha.id, levels: path.slice(index + 1) };
    }
  }

  return null;
};

export class HAFoldersEngine implements FoldersEngine {
  private _browseMediaManager: BrowseMediaWalker;
  private _cache = new BrowseMediaCache<BrowseMediaMetadata>();

  private _metadataGenerator: MetadataGenerator;
  private _thumbnailMetadataGenerator: ThumbnailMetadataGenerator;
  private _mediaMatcher: MediaMatcher;

  public constructor(
    templateRenderer: TemplateRenderer,
    options?: {
      browseMediaManager?: BrowseMediaWalker;
      metadataGenerator?: MetadataGenerator;
      thumbnailMetadataGenerator?: ThumbnailMetadataGenerator;
      mediaMatcher?: MediaMatcher;
    },
  ) {
    this._browseMediaManager = options?.browseMediaManager ?? new BrowseMediaWalker();
    this._metadataGenerator = options?.metadataGenerator ?? new MetadataGenerator();
    this._thumbnailMetadataGenerator =
      options?.thumbnailMetadataGenerator ??
      new ThumbnailMetadataGenerator(templateRenderer);
    this._mediaMatcher = options?.mediaMatcher ?? new MediaMatcher(templateRenderer);
  }

  public getItemCapabilities(item: ViewItem): ViewItemCapabilities | null {
    return {
      canFavorite: false,
      canDownload: !ViewItemClassifier.isFolder(item),
    };
  }

  public async getDownloadPath(
    hass: HomeAssistant,
    item: ViewItem,
    helpers?: DownloadHelpers,
  ): Promise<Endpoint | null> {
    if (!ViewItemClassifier.isMedia(item)) {
      return null;
    }

    return getMediaDownloadPath(hass, item.getContentID(), helpers?.resolvedMediaCache);
  }

  public async favorite(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _hass: HomeAssistant,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _item: ViewItem,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _favorite: boolean,
  ): Promise<void> {
    return;
  }

  public getDefaultQueryParameters(folder: FolderConfig): FolderQuery | null {
    if (folder.type !== folderTypeSchema.enum.ha) {
      return null;
    }
    return {
      source: QuerySource.Folder,
      folder,
      path: this._getDefaultPathComponents(folder.ha),
    };
  }

  private _getDefaultPathComponents(
    haFolderConfig?: HAFolderConfig,
  ): NonEmptyTuple<FolderPathComponent> {
    const shouldAddDefaultRoot =
      !haFolderConfig?.url && haFolderConfig?.path?.[0]?.id !== HA_MEDIA_SOURCE_ROOT;

    const path: HAFolderPathComponent[] = [
      ...(shouldAddDefaultRoot ? [{ id: HA_MEDIA_SOURCE_ROOT }] : []),
      ...(haFolderConfig?.url ?? []),
      ...(haFolderConfig?.path ?? []),
    ];

    return path.map((component) => ({ ha: component })) as [
      FolderPathComponent,
      ...FolderPathComponent[],
    ];
  }

  public async expandFolder(
    hass: HomeAssistant,
    query: FolderQuery,
    conditionState?: ConditionState,
    engineOptions?: EngineOptions,
  ): Promise<ViewItem[] | null> {
    if (query.folder.type !== folderTypeSchema.enum.ha) {
      return null;
    }

    const plan = getWalkPlan(query.path);
    if (!plan) {
      return null;
    }
    const { start, levels } = plan;

    await this._metadataGenerator.prepare(
      levels.flatMap((level) => level.ha?.parsers ?? []),
    );

    // Generate a walk step, optionally matching against the next level (if
    // any), otherwise just returning all the media at this level.
    const generateStep = (
      targets: BrowseMediaTarget<BrowseMediaMetadata>[],
    ): BrowseMediaStep<BrowseMediaMetadata>[] => {
      const nextLevel = levels.shift();

      return [
        {
          targets,
          metadataGenerator: (media, parent) =>
            this._metadataGenerator.generate(media, parent, nextLevel?.ha?.parsers),
          childrenMetadataUpdater: (children) =>
            this._thumbnailMetadataGenerator.generate(
              hass,
              children,
              nextLevel?.ha?.parsers,
            ),

          ...(nextLevel && {
            matcher: (media) =>
              this._mediaMatcher.match(hass, media, {
                matchers: nextLevel.ha?.matchers,
                // Set foldersOnly to true if there are more levels to walk, as
                // by definition only folders can be matched at this point.
                foldersOnly: levels.length > 0,
                conditionState,
              }),
            advance: (targets) => (levels.length ? generateStep(targets) : []),
          }),
        },
      ];
    };

    const browseMedia = await this._browseMediaManager.walk<BrowseMediaMetadata>(
      hass,
      generateStep([start]),
      {
        ...((engineOptions?.useCache ?? true) && { cache: this._cache }),
      },
    );

    // Remove media that exists as thumbnails of *other* media.
    const results =
      this._thumbnailMetadataGenerator.removeThumbnailsOfOtherMedia(browseMedia);

    return getViewItemsFromBrowseMediaArray(results, {
      folder: query.folder,
      path: query.path,
    });
  }

  public areResultsFresh(resultsTimestamp: Date, query: FolderQuery): boolean {
    return (
      !!query &&
      resultsTimestamp >= sub(new Date(), { seconds: BROWSE_MEDIA_CACHE_SECONDS })
    );
  }
}
