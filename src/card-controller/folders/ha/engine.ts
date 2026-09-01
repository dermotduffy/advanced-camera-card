import { sub } from 'date-fns';
import { findLastIndex } from 'lodash-es';
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
import type { ViewFolder, ViewItem } from '../../../view/item';
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

// The media a path component points the walk at: a folder the user navigated
// into or a media source id written in the configuration.
const getBrowseTarget = (
  component: FolderPathComponent,
): BrowseMediaTarget<BrowseMediaMetadata> | null => {
  const folderBrowseMedia =
    component.folder instanceof BrowseMediaViewFolder
      ? component.folder.getBrowseMedia()
      : null;
  return folderBrowseMedia ?? component.ha?.id ?? null;
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

    const pathComponents = [...query.path];

    // The walk starts at the last component with a fully qualified browse
    // target: the deepest folder the user has navigated into, or the deepest id
    // in the configuration.
    const browseTargets = pathComponents.map(getBrowseTarget);
    const startIndex = findLastIndex(browseTargets, (target) => target !== null);

    // findLastIndex returns -1 when no component has a target, leaving the walk
    // nowhere to start.
    const start = browseTargets[startIndex] ?? null;
    if (start === null) {
      return null;
    }

    pathComponents.splice(0, startIndex + 1);

    await this._metadataGenerator.prepare(
      pathComponents.flatMap((component) => component.ha?.parsers ?? []),
    );

    // Generate a walk step, optionally matching against the next path component
    // (if any), otherwise just returning all the media at this level.
    const generateStep = (
      targets: BrowseMediaTarget<BrowseMediaMetadata>[],
    ): BrowseMediaStep<BrowseMediaMetadata>[] => {
      const nextComponent = pathComponents.shift();

      return [
        {
          targets,
          metadataGenerator: (media, parent) =>
            this._metadataGenerator.generate(media, parent, nextComponent?.ha?.parsers),
          childrenMetadataUpdater: (children) =>
            this._thumbnailMetadataGenerator.generate(
              hass,
              children,
              nextComponent?.ha?.parsers,
            ),

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

    // Remove media that exists as thumbnails of *other* media.
    const results =
      this._thumbnailMetadataGenerator.removeThumbnailsOfOtherMedia(browseMedia);

    return getViewItemsFromBrowseMediaArray(results, {
      folder: query.folder,
      path: query.path,
    });
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
