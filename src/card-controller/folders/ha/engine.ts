import { NonEmptyTuple } from 'type-fest';
import {
  FolderConfig,
  folderTypeSchema,
  HA_MEDIA_SOURCE_ROOT,
  HAFolderConfig,
  HAFolderPathComponent,
} from '../../../config/schema/folders';
import { getViewItemsFromBrowseMediaArray } from '../../../ha/browse-media/browse-media-to-view-media';
import { BrowseMedia, BrowseMediaCache } from '../../../ha/browse-media/types';
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

export class HAFoldersEngine implements FoldersEngine {
  private _browseMediaManager: BrowseMediaWalker;
  private _cache = new BrowseMediaCache();

  public constructor(browseMediaManager?: BrowseMediaWalker) {
    this._browseMediaManager = browseMediaManager ?? new BrowseMediaWalker();
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
    let start: string | null = null;
    while (pathComponents.length > 0) {
      const id = pathComponents[0]?.id;
      if (id) {
        start = id;
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

    // This matcher matches a browse media against a given path component.
    const componentMatcher = (
      media: BrowseMedia,
      component?: FolderPathComponent,
    ): boolean => {
      return (
        !component ||
        (media.can_expand &&
          (component.ha?.title === media.title ||
            (component.ha?.title_re &&
              new RegExp(component.ha.title_re).test(media.title)) ||
            component.id === media.media_content_id))
      );
    };

    // Generate a walk step, optionally matching against the next path component
    // (if any), otherwise just returning all the media at this level.
    const generateStep = (targets: BrowseMediaTarget[]): BrowseMediaStep[] => {
      const nextComponent = pathComponents.shift();
      return [
        {
          targets,
          ...(nextComponent && {
            matcher: (media: BrowseMedia) => componentMatcher(media, nextComponent),
            advance: (targets) => generateStep(targets),
          }),
        },
      ];
    };

    const browseMedia = await this._browseMediaManager.walk(
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

  private getDefaultFolderPathComponents(
    haFolderConfig?: HAFolderConfig,
  ): NonEmptyTuple<FolderPathComponent> {
    const shouldAddDefaultRoot = !haFolderConfig?.url && !haFolderConfig?.path?.[0]?.id;

    const defaultPath = [
      ...(shouldAddDefaultRoot ? [{ id: HA_MEDIA_SOURCE_ROOT }] : []),
      ...(haFolderConfig?.url ?? []),
      ...(haFolderConfig?.path ?? []),
    ];

    return defaultPath.map((component) =>
      this._convertHAPathComponentToFolderPathComponent(component),
    ) as [FolderPathComponent, ...FolderPathComponent[]];
  }

  // Convert from the HA folder path component config schema to the general,
  // which pulls `path` to the top level.
  private _convertHAPathComponentToFolderPathComponent(
    component: HAFolderPathComponent,
  ): FolderPathComponent {
    return {
      id: component.id,
      ha: {
        ...component,
      },
    };
  }
}
