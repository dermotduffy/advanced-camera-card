import { sub } from 'date-fns';
import { NonEmptyTuple } from 'type-fest';
import { ConditionState } from '../../../conditions/types';
import {
  FolderConfig,
  folderTypeSchema,
  HA_MEDIA_SOURCE_ROOT,
  HAFolderConfig,
  HAFolderPathComponent,
} from '../../../config/schema/folders';
import { getViewItemsFromBrowseMediaArray } from '../../../ha/browse-media/browse-media-to-view-media';
import { BrowseMediaViewFolder } from '../../../ha/browse-media/item';
import {
  BROWSE_MEDIA_CACHE_SECONDS,
  BrowseMediaCache,
  BrowseMediaMetadata,
  RichBrowseMedia,
} from '../../../ha/browse-media/types';
import {
  BrowseMediaStep,
  BrowseMediaTarget,
  BrowseMediaWalker,
} from '../../../ha/browse-media/walker';
import { getMediaDownloadPath } from '../../../ha/download';
import { HomeAssistant } from '../../../ha/types';
import { QuerySource } from '../../../query-source.js';
import { Endpoint } from '../../../types';

import { ViewFolder, ViewItem } from '../../../view/item';
import { ViewItemClassifier } from '../../../view/item-classifier';
import { ViewItemCapabilities } from '../../../view/types';
import {
  DownloadHelpers,
  EngineOptions,
  FolderPathComponent,
  FolderQuery,
  FoldersEngine,
} from '../types';
import { MediaMatcher } from './media-matcher';
import { MetadataGenerator } from './metadata-generator.js';

export class HAFoldersEngine implements FoldersEngine {
  private _browseMediaManager: BrowseMediaWalker;
  private _cache = new BrowseMediaCache<BrowseMediaMetadata>();

  private _metadataGenerator: MetadataGenerator;
  private _mediaMatcher: MediaMatcher;

  public constructor(options?: {
    browseMediaManager?: BrowseMediaWalker;
    metadataGenerator?: MetadataGenerator;
    mediaMatcher?: MediaMatcher;
  }) {
    this._browseMediaManager = options?.browseMediaManager ?? new BrowseMediaWalker();
    this._metadataGenerator = options?.metadataGenerator ?? new MetadataGenerator();
    this._mediaMatcher = options?.mediaMatcher ?? new MediaMatcher();
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

    const pathComponents = [...query.path];

    // Search through the path components from the start to find the last
    // component with a precise media source id, which is where the queries
    // start (and may drill down from).
    let start: string | RichBrowseMedia<BrowseMediaMetadata> | null = null;
    while (pathComponents.length > 0) {
      const folderBrowseMedia =
        pathComponents[0]?.folder instanceof BrowseMediaViewFolder
          ? pathComponents[0].folder.getBrowseMedia()
          : null;

      const validStart = folderBrowseMedia ?? pathComponents[0]?.ha?.id ?? null;
      if (validStart) {
        start = validStart;
        pathComponents.shift();
      } else {
        break;
      }
    }

    // If no media source id is found, return null, as there is no "starting
    // query".
    if (start === null) {
      return null;
    }

    await this._metadataGenerator.prepare(
      pathComponents.flatMap((component) => component.ha?.parsers ?? []),
    );

    // Generate a walk step, optionally matching against the next path component
    // (if any), otherwise just returning all the media at this level.
    const generateStep = (
      targets: BrowseMediaTarget<BrowseMediaMetadata>[],
    ): BrowseMediaStep<BrowseMediaMetadata>[] => {
      const nextComponent = pathComponents.shift();
      const limit = query.limit ?? null;

      return [
        {
          targets,
          metadataGenerator: (media, parent) =>
            this._metadataGenerator.generate(media, parent, nextComponent?.ha?.parsers),

          // At the final step (no nextComponent), apply limit via earlyExit.
          ...(limit && {
            earlyExit: (media) => media.length >= limit,
          }),

          ...(nextComponent && {
            matcher: (media) =>
              this._mediaMatcher.match(hass, media, {
                matchers: nextComponent.ha?.matchers,
                // Set foldersOnly to true if there are more stages in the path,
                // as by definition only folders can be matched at this point.
                foldersOnly: pathComponents.length > 0,
                conditionState,
              }),
            advance: (targets) => (pathComponents.length ? generateStep(targets) : []),
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

    const results = getViewItemsFromBrowseMediaArray(browseMedia, {
      folder: query.folder,
      path: query.path,
    });
    return query.limit ? results.slice(0, query.limit) : results;
  }

  public generateChildFolderQuery(
    query: FolderQuery,
    folder: ViewFolder,
  ): FolderQuery | null {
    const id = folder.getID();
    if (query.folder.type !== folderTypeSchema.enum.ha || !id) {
      return null;
    }

    // Get the full configured path to find parsers/matchers for this depth.
    const fullPath = this._getDefaultPathComponents(query.folder.ha);
    const nextConfiguredComponent = fullPath[query.path.length];

    // Use the configured component's parsers/matchers if available, otherwise
    // just use the ID from the folder.
    const ha = nextConfiguredComponent?.ha ?? { id };

    return {
      ...query,
      path: [...query.path, { folder, ha }],
    };
  }

  public areResultsFresh(resultsTimestamp: Date, query: FolderQuery): boolean {
    return (
      !!query &&
      resultsTimestamp >= sub(new Date(), { seconds: BROWSE_MEDIA_CACHE_SECONDS })
    );
  }
}
