import { sub } from 'date-fns';

import type { ConditionState } from '../../../condition-trigger/conditions/types';
import {
  folderNavigationSchema,
  folderTypeSchema,
  type FolderConfig,
  type HAFolderConfig,
  type HAFolderPathComponent,
  type Matcher,
  type Parser,
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
import type { ViewFolder, ViewItem } from '../../../view/item';
import { ViewItemClassifier } from '../../../view/item-classifier';
import type { ViewItemCapabilities } from '../../../view/types';
import type { TemplateRenderer } from '../../templates';
import type {
  DownloadHelpers,
  EngineOptions,
  FolderPathLevel,
  FolderQuery,
  FoldersEngine,
} from '../types';
import { MediaMatcher } from './media-matcher';
import { MetadataGenerator } from './metadata-generator.js';
import { ThumbnailMetadataGenerator } from './thumbnail-metadata-generator';

// A folder hierarchy level combining the folder configuration and the user's
// navigation.
interface WalkLevel {
  target?: BrowseMediaTarget<BrowseMediaMetadata>;
  matchers?: Matcher[];
  parsers?: Parser[];
}

interface WalkPlan {
  // Where the walk starts browsing.
  start: BrowseMediaTarget<BrowseMediaMetadata>;

  // What to match and parse at each level below the start, one entry per level.
  levels: WalkLevel[];
}

// Find the deepest level that identifies media to browse.
const getWalkPlan = (levels: readonly WalkLevel[]): WalkPlan | null => {
  for (let index = levels.length - 1; index >= 0; index--) {
    const target = levels[index].target;

    if (target) {
      return { start: target, levels: levels.slice(index + 1) };
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

    // The default path is just '{}' for each configured level. As the user
    // navigates around, its components become pinned to particular folders.
    // Each is merged with the configured level to preserve its matchers and
    // parsers.
    return {
      source: QuerySource.Folder,
      folder,
      path: this._getConfiguredPathComponents(folder.ha).map(
        (): FolderPathLevel => ({}),
      ),
    };
  }

  public getUpQuery(query: FolderQuery): FolderQuery | null {
    // Going up removes the level being viewed.
    const resultingLevels = query.path.length - 1;

    const minimumLevels =
      query.folder.navigation === folderNavigationSchema.enum.unrestricted
        ? // The shallowest possible path has 2 levels: level 0 (which names
          // where the configuration starts browsing and is never itself
          // displayed), and level 1 (the contents of level 0), which is what
          // the user sees.
          2
        : // In restricted navigation, the user may go no further
          // up than the root path in the configuration.
          this._getConfiguredPathComponents(query.folder.ha).length;

    if (resultingLevels < minimumLevels) {
      return null;
    }

    // To navigate upwards:
    // - Cut the last element off the path.
    // - Replace the one before that with an empty element to avoid "pinning" /
    //   only-showing the parent folder, and rather showing its siblings too.
    //   That empty element is later merged with level-appropriate
    //   matchers/parsers from the config.
    return { ...query, path: [...query.path.slice(0, -2), {}] };
  }

  public getDownQuery(item: ViewFolder): FolderQuery {
    // To navigate downwards into a folder:
    // - Replace the level the folder was shown at (it and its siblings) with
    //   the folder item itself.
    // - Append an empty element for the level below that folder (the level to
    //   be displayed). This will be merged with the matching configured level
    //   (if it exists), to include relevant parsers/matchers for that level.
    return {
      source: QuerySource.Folder,
      folder: item.getFolder(),
      path: [...item.getPath().slice(0, -1), { folder: item }, {}],
    };
  }

  private _getConfiguredPathComponents(
    haFolderConfig?: HAFolderConfig,
  ): HAFolderPathComponent[] {
    const shouldAddDefaultRoot =
      !haFolderConfig?.url && haFolderConfig?.path?.[0]?.id !== HA_MEDIA_SOURCE_ROOT;

    const components: HAFolderPathComponent[] = [
      ...(shouldAddDefaultRoot ? [{ id: HA_MEDIA_SOURCE_ROOT }] : []),
      ...(haFolderConfig?.url ?? []),
      ...(haFolderConfig?.path ?? []),
    ];

    const innermost: HAFolderPathComponent | undefined =
      components[components.length - 1];

    /* v8 ignore if: a default root is added when nothing else is configured, so
       there is always at least one component and this cannot be reached --
       @preserve */
    if (!innermost) {
      return components;
    }

    // The last component is the level on display. Where that component names a
    // single media item by id, a component is added after it so the card shows
    // that item's contents rather than its siblings.
    if (innermost.id) {
      components.push({});
    }

    return components;
  }

  private _getWalkLevels(
    folder: FolderConfig,
    path: readonly FolderPathLevel[],
  ): WalkLevel[] {
    const configuredComponents = this._getConfiguredPathComponents(folder.ha);
    const displayedIndex = path.length - 1;

    return path.map((component, index): WalkLevel => {
      const configured: HAFolderPathComponent | undefined = configuredComponents[index];

      if (component.folder instanceof BrowseMediaViewFolder) {
        return {
          target: component.folder.getBrowseMedia(),
        };
      }

      return {
        // Browse the named folder. For the last level, there is no target as
        // it's the children of the level above.
        target: index === displayedIndex ? undefined : configured?.id,
        matchers: configured?.matchers,
        parsers: configured?.parsers,
      };
    });
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

    const plan = getWalkPlan(this._getWalkLevels(query.folder, query.path));
    if (!plan) {
      return null;
    }
    const { start, levels } = plan;

    await this._metadataGenerator.prepare(
      levels.flatMap((level) => level.parsers ?? []),
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
            this._metadataGenerator.generate(media, parent, nextLevel?.parsers),
          childrenMetadataUpdater: (children) =>
            this._thumbnailMetadataGenerator.generate(
              hass,
              children,
              nextLevel?.parsers,
            ),

          ...(nextLevel && {
            matcher: (media) =>
              this._mediaMatcher.match(hass, media, {
                matchers: nextLevel.matchers,
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
