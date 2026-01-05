import { NonEmptyTuple } from 'type-fest';
import { ConditionState } from '../../conditions/types';
import { FolderConfig, HAFolderPathComponent } from '../../config/schema/folders';
import { ResolvedMediaCache } from '../../ha/resolved-media';
import { HomeAssistant } from '../../ha/types';
import { BaseQuery, QuerySource } from '../../query-source';
import { Endpoint } from '../../types';
import { AdvancedCameraCardError } from '../../types.js';
import { ViewFolder, ViewItem } from '../../view/item';
import { ViewItemCapabilities } from '../../view/types';

// ====
// Base
// ====

export interface EngineOptions {
  useCache?: boolean;
}

export class FolderInitializationError extends AdvancedCameraCardError {}

// ============
// Folder Query
// ============

interface FolderPathComponentMetadata {
  ha?: HAFolderPathComponent;
}

export interface FolderPathComponent extends FolderPathComponentMetadata {
  folder?: ViewFolder;
}

export interface FolderQuery extends BaseQuery {
  source: QuerySource.Folder;
  folder: FolderConfig;

  // A trail of paths to navigate back to the "root", with the last path being
  // the path that this query directly refers to.
  path: NonEmptyTuple<FolderPathComponent>;
  limit?: number;
}

// ===============
// Folders Engines
// ===============

export interface DownloadHelpers {
  resolvedMediaCache?: ResolvedMediaCache | null;
}

export interface FoldersEngine {
  getDefaultQueryParameters(folder: FolderConfig): FolderQuery | null;

  generateChildFolderQuery(query: FolderQuery, folder: ViewFolder): FolderQuery | null;

  expandFolder(
    hass: HomeAssistant,
    query: FolderQuery,
    conditionState?: ConditionState,
    engineOptions?: EngineOptions,
  ): Promise<ViewItem[] | null>;

  getItemCapabilities(item: ViewItem): ViewItemCapabilities | null;
  getDownloadPath(
    hass: HomeAssistant | null,
    item: ViewItem,
    options?: DownloadHelpers,
  ): Promise<Endpoint | null>;

  favorite(hass: HomeAssistant | null, item: ViewItem, favorite: boolean): Promise<void>;

  areResultsFresh(resultsTimestamp: Date, query: FolderQuery): boolean;
}
