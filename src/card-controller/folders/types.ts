import type { ConditionState } from '../../condition-trigger/conditions/types';
import type { FolderConfig } from '../../config/schema/folders';
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

export interface FolderPathLevel {
  // A folder the user navigated into at this level. If unspecified, the level
  // is taken from the folder configuration instead.
  folder?: ViewFolder;
}

export interface FolderQuery extends BaseQuery, QueryFilters {
  source: QuerySource.Folder;
  folder: FolderConfig;

  // One entry per level of the media hierarchy, outermost first. The last entry
  // is the level this query refers to.
  path: FolderPathLevel[];
}

// ===============
// Folders Engines
// ===============

export interface DownloadHelpers {
  resolvedMediaCache?: ResolvedMediaCache | null;
}

export interface FoldersEngine {
  getDefaultQueryParameters(folder: FolderConfig): FolderQuery | null;

  getUpQuery(query: FolderQuery): FolderQuery | null;
  getDownQuery(item: ViewFolder): FolderQuery;

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
