import type { NonEmptyTuple } from 'type-fest';

import type { ConditionState } from '../../condition-trigger/conditions/types';
import type { FolderConfig, HAFolderPathComponent } from '../../config/schema/folders';
import type { ResolvedMediaCache } from '../../ha/resolved-media';
import type { HomeAssistant } from '../../ha/types';
import type { BaseQuery, QueryFilters, QuerySource } from '../../query-source';
import type { Endpoint } from '../../types';
import { AdvancedCameraCardError } from '../../types.js';
import type { ViewFolder, ViewItem } from '../../view/item';
import type { ViewItemCapabilities } from '../../view/types';

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

export interface FolderQuery extends BaseQuery, QueryFilters {
  source: QuerySource.Folder;
  folder: FolderConfig;

  // A trail of paths to navigate back to the "root", with the last path being
  // the path that this query directly refers to.
  path: NonEmptyTuple<FolderPathComponent>;
}

// ===============
// Folders Engines
// ===============

export interface DownloadHelpers {
  resolvedMediaCache?: ResolvedMediaCache | null;
}

export interface FoldersEngine {
  getDefaultQueryParameters(folder: FolderConfig): FolderQuery | null;

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
