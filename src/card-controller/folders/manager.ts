import { cloneDeep } from 'lodash-es';
import { FolderConfig } from '../../config/schema/folders';
import { localize } from '../../localize/localize';
import { Endpoint } from '../../types';
import { ViewItem } from '../../view/item';
import { ViewItemCapabilities } from '../../view/types';
import { CardFoldersAPI } from '../types';
import { FoldersExecutor } from './executor';
import { EngineOptions, FolderInitializationError, FolderQuery } from './types';

export class FoldersManager {
  private _api: CardFoldersAPI;
  private _executor: FoldersExecutor;
  private _folders: Map<string, FolderConfig> = new Map();

  constructor(api: CardFoldersAPI, executor?: FoldersExecutor) {
    this._api = api;
    this._executor = executor ?? new FoldersExecutor();
  }

  public deleteFolders(): void {
    this._folders.clear();
  }

  public addFolders(folders: FolderConfig[]): void {
    for (const folder of folders) {
      const folderNumber = this._folders.size;
      const id = folder.id ?? `folder/${folderNumber.toString()}`;
      if (this._folders.has(id)) {
        throw new FolderInitializationError(
          localize('error.duplicate_folder_id'),
          folder,
        );
      }

      this._folders.set(id, {
        title: `${localize('common.folder')} ${folderNumber}`,
        ...cloneDeep(folder),
        id,
      });
    }
  }

  public getFolderCount(): number {
    return this._folders.size;
  }
  public getFolders(): MapIterator<[string, FolderConfig]> {
    return this._folders.entries();
  }
  public getFolder(id?: string): FolderConfig | null {
    return id
      ? this._folders.get(id) ?? null
      : this._folders.values().next().value ?? null;
  }

  public generateDefaultFolderQuery(folder?: FolderConfig): FolderQuery | null {
    const _folder = folder ?? this.getFolder();
    return _folder ? this._executor.generateDefaultFolderQuery(_folder) : null;
  }

  public async expandFolder(
    query: FolderQuery,
    engineOptions?: EngineOptions,
  ): Promise<ViewItem[] | null> {
    const hass = this._api.getHASSManager().getHASS();
    return hass ? this._executor.expandFolder(hass, query, engineOptions) : null;
  }

  public getItemCapabilities(item: ViewItem): ViewItemCapabilities | null {
    return this._executor.getItemCapabilities(item);
  }

  public async getDownloadPath(item: ViewItem): Promise<Endpoint | null> {
    return await this._executor.getDownloadPath(
      this._api.getHASSManager().getHASS(),
      item,
      {
        resolvedMediaCache: this._api.getResolvedMediaCache(),
      },
    );
  }

  public async favorite(item: ViewItem, favorite: boolean): Promise<void> {
    return await this._executor.favorite(
      this._api.getHASSManager().getHASS(),
      item,
      favorite,
    );
  }
}
