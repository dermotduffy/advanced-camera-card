import { ConditionState } from '../../conditions/types';
import { FolderConfig, FolderType, folderTypeSchema } from '../../config/schema/folders';
import { HomeAssistant } from '../../ha/types';
import { Endpoint } from '../../types';
import { ViewFolder, ViewItem } from '../../view/item';
import { ViewItemCapabilities } from '../../view/types';
import { sortItems } from '../view/sort';
import { HAFoldersEngine } from './ha/engine';
import { DownloadHelpers, EngineOptions, FolderQuery, FoldersEngine } from './types';

export class FoldersExecutor {
  private _ha: FoldersEngine;

  constructor(engines?: { ha?: HAFoldersEngine }) {
    this._ha = engines?.ha ?? new HAFoldersEngine();
  }

  public generateDefaultFolderQuery(folder: FolderConfig): FolderQuery | null {
    return (
      this._getFolderEngine(folder.type)?.generateDefaultFolderQuery(folder) ?? null
    );
  }

  public generateChildFolderQuery(
    query: FolderQuery,
    folder: ViewFolder,
  ): FolderQuery | null {
    return (
      this._getFolderEngine(query.folder.type)?.generateChildFolderQuery(
        query,
        folder,
      ) ?? null
    );
  }

  public async expandFolder(
    hass: HomeAssistant,
    query: FolderQuery,
    conditionState?: ConditionState,
    engineOptions?: EngineOptions,
  ): Promise<ViewItem[] | null> {
    const results =
      (await this._getFolderEngine(query.folder.type)?.expandFolder(
        hass,
        query,
        conditionState,
        engineOptions,
      )) ?? null;
    return results ? sortItems(results) : null;
  }

  public getItemCapabilities(item: ViewItem): ViewItemCapabilities | null {
    return (
      this._getFolderEngine(item.getFolder()?.type)?.getItemCapabilities(item) ?? null
    );
  }

  public async getDownloadPath(
    hass: HomeAssistant | null,
    item: ViewItem,
    helpers?: DownloadHelpers,
  ): Promise<Endpoint | null> {
    return await (this._getFolderEngine(item.getFolder()?.type)?.getDownloadPath(
      hass,
      item,
      helpers,
    ) ?? null);
  }

  public async favorite(
    hass: HomeAssistant | null,
    item: ViewItem,
    favorite: boolean,
  ): Promise<void> {
    return await this._getFolderEngine(item.getFolder()?.type)?.favorite(
      hass,
      item,
      favorite,
    );
  }

  private _getFolderEngine(type?: FolderType): FoldersEngine | null {
    switch (type) {
      case folderTypeSchema.enum.ha:
        return this._ha;
    }
    return null;
  }
}
