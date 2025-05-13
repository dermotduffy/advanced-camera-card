import { folderTypeSchema, HAFolderConfig } from '../../../config/schema/folders';
import { getViewItemsFromBrowseMediaArray } from '../../../ha/browse-media/browse-media-to-view-media';
import { BrowseMediaCache, BrowseMediaMetadata } from '../../../ha/browse-media/types';
import { BrowseMediaWalker } from '../../../ha/browse-media/walker';
import { getMediaDownloadPath } from '../../../ha/download';
import { HomeAssistant } from '../../../ha/types';
import { Endpoint } from '../../../types';
import { ViewItem } from '../../../view/item';
import { ViewItemClassifier } from '../../../view/item-classifier';
import { ViewItemCapabilities } from '../../../view/types';
import { DownloadHelpers, EngineOptions, FolderQuery, FoldersEngine } from '../types';

export class HAFoldersEngine implements FoldersEngine {
  private _browseMediaManager: BrowseMediaWalker;
  private _cache = new BrowseMediaCache<BrowseMediaMetadata>();

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

  public async expandFolder(
    hass: HomeAssistant,
    query: FolderQuery,
    engineOptions?: EngineOptions,
  ): Promise<ViewItem[] | null> {
    if (query.folder.type !== folderTypeSchema.enum.ha) {
      return null;
    }
    const target = query.path ?? this._getRoot(query.folder.ha);
    if (!target) {
      return null;
    }

    const browseMedia = await this._browseMediaManager.walk(
      hass,
      [
        {
          targets: [target],
        },
      ],
      {
        ...((engineOptions?.useCache ?? true) && { cache: this._cache }),
      },
    );
    return getViewItemsFromBrowseMediaArray(browseMedia, {
      folder: query.folder,
    });
  }

  private _getRoot(haFolderConfig?: HAFolderConfig): string | null {
    if (haFolderConfig?.root) {
      return haFolderConfig.root;
    }
    return null;
  }
}
