import { NonEmptyTuple } from 'type-fest';
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
  BrowseMedia,
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
import { Endpoint } from '../../../types';
import { ViewItem } from '../../../view/item';
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

  public generateDefaultFolderQuery(folder: FolderConfig): FolderQuery | null {
    if (folder.type !== folderTypeSchema.enum.ha) {
      return null;
    }
    return {
      folder,
      path: this.getDefaultFolderPathComponents(folder.ha),
    };
  }

  private getDefaultFolderPathComponents(
    haFolderConfig?: HAFolderConfig,
  ): NonEmptyTuple<FolderPathComponent> {
    const shouldAddDefaultRoot = !haFolderConfig?.url && !haFolderConfig?.path?.[0]?.id;

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
      return [
        {
          targets,
          metadataGenerator: (media: BrowseMedia, parent?: BrowseMedia) =>
            this._metadataGenerator.generate(media, parent, nextComponent?.ha?.parsers),

          ...(nextComponent && {
            matcher: (media: BrowseMedia) =>
              this._mediaMatcher.match(
                media,
                nextComponent.ha?.matchers,
                // Set foldersOnly to true if there are more stages in the path,
                // as by definition only folders can be matched at this point.
                pathComponents.length > 0,
              ),
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

    return getViewItemsFromBrowseMediaArray(browseMedia, {
      folder: query.folder,
    });
  }
}
